import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * KakaoWork Block Kit 페이로드를 생성합니다.
 * @param {string} eventName - GitHub Actions 이벤트 이름 ('push' | 'pull_request')
 * @param {object} event - GitHub 이벤트 JSON 객체
 * @returns {{ text: string, blocks: Array<object> } | null}
 */
export function buildKakaoWorkPayload(eventName, event) {
  if (!event) return null;

  if (eventName === 'push') {
    // dev 브랜치 대상 푸시만 처리
    const branch = event.ref?.replace('refs/heads/', '') || '';
    if (branch !== 'dev') {
      return null;
    }

    const commits = Array.isArray(event.commits) ? event.commits : [];
    const commitCount = commits.length;
    const pusher = event.pusher?.name || event.head_commit?.author?.name || '알 수 없음';
    const repoName = event.repository?.full_name || 'Jun-pepsi-limeflavor/medi-da-kos';
    const compareUrl = event.compare || '';

    // 커밋 최대 15개 표시
    const maxCommits = 15;
    const displayCommits = commits.slice(0, maxCommits);
    const commitLines = displayCommits.map((c) => {
      const shortHash = (c.id || '').substring(0, 7) || 'unknown';
      const firstLine = (c.message || '').split('\n')[0].trim();
      const author = c.author?.username || c.author?.name || 'unknown';
      return `• [\`${shortHash}\`] ${firstLine} (@${author})`;
    });

    if (commitCount > maxCommits) {
      commitLines.push(`+ 외 ${commitCount - maxCommits}개의 커밋이 더 있습니다.`);
    }

    const commitSectionText =
      commitLines.length > 0
        ? `**📝 푸시된 커밋 (${commitCount}개):**\n${commitLines.join('\n')}`
        : '**📝 푸시된 커밋이 없습니다.**';

    const blocks = [
      {
        type: 'header',
        text: `🚀 [dev] 새 커밋 푸시 (${commitCount}개)`,
        style: 'blue',
      },
      {
        type: 'description',
        term: '저장소',
        content: {
          type: 'text',
          text: repoName,
          markdown: true,
        },
        accent: true,
      },
      {
        type: 'description',
        term: '작성자',
        content: {
          type: 'text',
          text: pusher,
          markdown: true,
        },
        accent: false,
      },
      {
        type: 'description',
        term: '브랜치',
        content: {
          type: 'text',
          text: '`dev`',
          markdown: true,
        },
        accent: false,
      },
      {
        type: 'divider',
      },
      {
        type: 'text',
        text: commitSectionText,
        markdown: true,
      },
    ];

    if (compareUrl) {
      blocks.push({
        type: 'button',
        text: '🔍 변경사항 비교 (Compare)',
        style: 'primary',
        action_type: 'open_inapp_browser',
        value: compareUrl,
      });
    }

    return {
      text: `[dev] 새 커밋 푸시 (${commitCount}개) - ${pusher}`,
      blocks,
    };
  }

  if (eventName === 'pull_request') {
    const pr = event.pull_request;
    if (!pr) return null;

    const baseBranch = pr.base?.ref || '';
    // main 브랜치 대상 PR만 처리
    if (baseBranch !== 'main') {
      return null;
    }

    const action = event.action;
    const headBranch = pr.head?.ref || '';
    const prTitle = pr.title || '제목 없음';
    const prNumber = pr.number;
    const prUrl = pr.html_url || '';
    const author = pr.user?.login || '알 수 없음';

    if (action === 'opened' || action === 'reopened') {
      const isReopened = action === 'reopened';
      const statusText = isReopened ? '재오픈 (Reopened)' : '검토 요청 (Open)';
      const headerTitle = isReopened
        ? `📬 [PR #${prNumber}] 풀 리퀘스트 재오픈`
        : `📬 [PR #${prNumber}] 풀 리퀘스트 등록`;

      return {
        text: `${headerTitle}: ${prTitle}`,
        blocks: [
          {
            type: 'header',
            text: headerTitle,
            style: 'yellow',
          },
          {
            type: 'description',
            term: 'PR 제목',
            content: {
              type: 'text',
              text: prTitle,
              markdown: true,
            },
            accent: true,
          },
          {
            type: 'description',
            term: '작성자',
            content: {
              type: 'text',
              text: `@${author}`,
              markdown: true,
            },
            accent: false,
          },
          {
            type: 'description',
            term: '브랜치',
            content: {
              type: 'text',
              text: `\`${headBranch}\` ➔ \`${baseBranch}\``,
              markdown: true,
            },
            accent: false,
          },
          {
            type: 'description',
            term: '상태',
            content: {
              type: 'text',
              text: statusText,
              markdown: true,
            },
            accent: false,
          },
          {
            type: 'divider',
          },
          {
            type: 'button',
            text: '👉 PR 검토 및 확인하기',
            style: 'primary',
            action_type: 'open_inapp_browser',
            value: prUrl,
          },
        ],
      };
    }

    if (action === 'closed') {
      // 머지되지 않고 단순히 닫힌 PR은 알림 제외
      if (!pr.merged) {
        return null;
      }

      const mergedBy = pr.merged_by?.login || author;

      return {
        text: `🎉 [PR #${prNumber}] main 브랜치 머지 완료: ${prTitle}`,
        blocks: [
          {
            type: 'header',
            text: `🎉 [PR #${prNumber}] main 브랜치 머지 완료`,
            style: 'blue',
          },
          {
            type: 'description',
            term: 'PR 제목',
            content: {
              type: 'text',
              text: prTitle,
              markdown: true,
            },
            accent: true,
          },
          {
            type: 'description',
            term: '머지 진행자',
            content: {
              type: 'text',
              text: `@${mergedBy}`,
              markdown: true,
            },
            accent: false,
          },
          {
            type: 'description',
            term: '브랜치',
            content: {
              type: 'text',
              text: `\`${headBranch}\` ➔ \`${baseBranch}\``,
              markdown: true,
            },
            accent: false,
          },
          {
            type: 'description',
            term: '배포 안내',
            content: {
              type: 'text',
              text: 'main 브랜치에 성공적으로 머지되었습니다.',
              markdown: true,
            },
            accent: false,
          },
          {
            type: 'divider',
          },
          {
            type: 'button',
            text: '🔍 머지된 PR 내역 보기',
            style: 'default',
            action_type: 'open_inapp_browser',
            value: prUrl,
          },
        ],
      };
    }
  }

  return null;
}

/**
 * 카카오워크 봇이 참여한 대화방 목록에서 방 이름으로 conversation_id를 조회합니다.
 * @param {string} appKey - 카카오워크 봇 App Key
 * @param {string} [roomName='개발-medidakos(화장품)'] - 검색할 대화방 이름
 * @param {typeof fetch} [fetchFn=fetch] - fetch 함수
 * @returns {Promise<string | null>}
 */
export async function resolveConversationId(appKey, roomName = '개발-medidakos(화장품)', fetchFn = fetch) {
  if (!appKey) return null;

  try {
    let cursor = null;
    const allConversations = [];

    do {
      const url = cursor
        ? `https://api.kakaowork.com/v1/conversations.list?cursor=${encodeURIComponent(cursor)}`
        : 'https://api.kakaowork.com/v1/conversations.list';

      const res = await fetchFn(url, {
        headers: {
          Authorization: `Bearer ${appKey}`,
        },
      });

      if (!res.ok) {
        break;
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.conversations)) {
        break;
      }

      allConversations.push(...data.conversations);
      cursor = data.cursor;
    } while (cursor);

    if (allConversations.length === 0) {
      return null;
    }

    // 1. 정확히 일치하는 방 이름 찾기
    const exactMatch = allConversations.find((c) => c.name === roomName);
    if (exactMatch) {
      return exactMatch.id;
    }

    // 2. 입력된 roomName을 포함하는 방 찾기
    if (roomName) {
      const partialMatch = allConversations.find(
        (c) => c.name && c.name.includes(roomName)
      );
      if (partialMatch) {
        return partialMatch.id;
      }
    }

    // 3. 'medidakos' 키워드를 포함하는 그룹 대화방 찾기
    const medidakosGroup = allConversations.find(
      (c) => c.type === 'group' && c.name && c.name.toLowerCase().includes('medidakos')
    );
    if (medidakosGroup) {
      return medidakosGroup.id;
    }

    // 4. 단체 대화방이 1개만 존재하는 경우 자동 매핑
    const groupConversations = allConversations.filter((c) => c.type === 'group');
    if (groupConversations.length === 1) {
      return groupConversations[0].id;
    }

    return null;
  } catch (error) {
    console.error('[KakaoWork] Error resolving conversation ID:', error);
    return null;
  }
}

/**
 * 카카오워크로 메시지(Block Kit)를 전송합니다.
 * (Bot App Key 또는 Incoming Webhook URL 방식 모두 지원)
 * @param {string | { appKey?: string, webhookUrl?: string, conversationId?: string, roomName?: string }} config - 연동 설정
 * @param {object} payload - Block Kit 메시지 페이로드
 * @param {typeof fetch} [fetchFn=fetch] - fetch 함수 (테스트용 주입 가능)
 * @returns {Promise<{ ok: boolean, status: number, body?: string }>}
 */
export async function sendKakaoWorkMessage(config, payload, fetchFn = fetch) {
  let appKey = '';
  let webhookUrl = '';
  let conversationId = '';
  let roomName = '개발-medidakos(화장품)';

  if (typeof config === 'string') {
    if (config.startsWith('http://') || config.startsWith('https://')) {
      webhookUrl = config;
    } else {
      appKey = config;
    }
  } else if (config && typeof config === 'object') {
    appKey = config.appKey || '';
    webhookUrl = config.webhookUrl || '';
    conversationId = config.conversationId || '';
    if (config.roomName) roomName = config.roomName;
  }

  if (!appKey && !webhookUrl) {
    throw new Error('KAKAOWORK_APP_KEY or KAKAOWORK_WEBHOOK_URL is required');
  }

  // 1. Incoming Webhook URL 방식인 경우
  if (webhookUrl) {
    const response = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await response.text().catch(() => '');
    return {
      ok: response.ok,
      status: response.status,
      body: responseBody,
    };
  }

  // 2. Bot API Key 방식인 경우
  if (!conversationId) {
    conversationId = await resolveConversationId(appKey, roomName, fetchFn);
  }

  if (!conversationId) {
    console.warn(
      `[KakaoWork] 대화방을 찾을 수 없습니다. 카카오워크 채팅방에 'git알리미' 봇을 먼저 초대해 주세요.`
    );
    return {
      ok: false,
      status: 404,
      body: `Conversation not found. Please invite git알리미 bot to the chat room.`,
    };
  }

  const messageBody = {
    conversation_id: conversationId,
    text: payload.text,
    blocks: payload.blocks,
  };

  const response = await fetchFn('https://api.kakaowork.com/v1/messages.send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messageBody),
  });

  const responseBody = await response.text().catch(() => '');
  let isSuccess = response.ok;

  try {
    const json = JSON.parse(responseBody);
    if (json.success === false) {
      isSuccess = false;
    }
  } catch {
    // ignore json parse error
  }

  if (!isSuccess) {
    console.error(`[KakaoWork Message Error] Status: ${response.status}, Body: ${responseBody}`);
  }

  return {
    ok: isSuccess,
    status: response.status,
    body: responseBody,
  };
}

/**
 * CLI 진입점: GitHub Actions 워크플로우에서 직접 실행될 때 호출됩니다.
 */
async function run() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const appKey =
    process.env.KAKAOWORK_APP_KEY ||
    process.env.KAKAOWORK_API_KEY ||
    process.env.KAKAOWORK_WEBHOOK_URL ||
    '';
  const conversationId = process.env.KAKAOWORK_CONVERSATION_ID || '';
  const roomName = process.env.KAKAOWORK_ROOM_NAME || '개발-medidakos(화장품)';

  if (!eventPath || !eventName) {
    console.log('[KakaoWork Notify] GITHUB_EVENT_PATH or GITHUB_EVENT_NAME is missing. Exiting.');
    return;
  }

  if (!appKey) {
    console.warn('[KakaoWork Notify] KAKAOWORK_APP_KEY is not configured in secrets. Skipping notification.');
    return;
  }

  try {
    const rawEvent = fs.readFileSync(eventPath, 'utf8');
    const event = JSON.parse(rawEvent);

    const payload = buildKakaoWorkPayload(eventName, event);
    if (!payload) {
      console.log(`[KakaoWork Notify] Event '${eventName}' is not a target notification event. Skipping.`);
      return;
    }

    console.log(`[KakaoWork Notify] Sending notification for ${eventName}...`);
    const result = await sendKakaoWorkMessage(
      {
        appKey,
        conversationId,
        roomName,
      },
      payload
    );

    if (result.ok) {
      console.log('[KakaoWork Notify] Successfully delivered notification to KakaoWork.');
    } else {
      console.error(`[KakaoWork Notify] Failed to deliver message. Status: ${result.status}, Body: ${result.body}`);
    }
  } catch (error) {
    console.error('[KakaoWork Notify] Unexpected error during execution:', error);
  }
}

// 스크립트가 직접 실행되었을 때 run() 실행
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
