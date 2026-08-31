import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildKakaoWorkPayload,
  resolveConversationId,
  sendKakaoWorkMessage,
} from '../.github/scripts/kakaowork-notify.mjs';

describe('buildKakaoWorkPayload', () => {
  describe('push event', () => {
    it('dev 브랜치에 20개의 커밋이 푸시될 때 최대 6개만 렌더링하고 500자 이하를 엄격히 보장해야 한다', () => {
      const commits = Array.from({ length: 20 }, (_, i) => ({
        id: `commit${String(i).padStart(2, '0')}abcdef123456`,
        message: `feat: change number ${i + 1}\n\nDetail body`,
        author: { name: `developer${i + 1}`, username: `dev${i + 1}` },
      }));

      const event = {
        ref: 'refs/heads/dev',
        repository: {
          full_name: 'Jun-pepsi-limeflavor/medi-da-kos',
        },
        pusher: {
          name: 'giwook',
        },
        compare: 'https://github.com/Jun-pepsi-limeflavor/medi-da-kos/compare/abc...def',
        commits,
      };

      const payload = buildKakaoWorkPayload('push', event);
      assert.ok(payload);
      assert.ok(payload.text.includes('[dev] 새 커밋 푸시 (20개)'));

      // Check header block (max 20 chars limit)
      const headerBlock = payload.blocks.find((b) => b.type === 'header');
      assert.equal(headerBlock?.text, '🚀 [dev] 새 커밋 (20개)');
      assert.ok(headerBlock?.text.length <= 20);
      assert.equal(headerBlock?.style, 'blue');

      // Check text block for commits (max 420 chars limit)
      const textBlock = payload.blocks.find((b) => b.type === 'text');
      assert.ok(textBlock);
      assert.ok(textBlock.text.length <= 420);

      // Verify first commit is included
      assert.ok(textBlock.text.includes('commit0'));
      assert.ok(textBlock.text.includes('feat: change number 1'));

      // Verify 20th commit is not listed and suffix is present
      assert.ok(!textBlock.text.includes('feat: change number 20'));
      assert.ok(textBlock.text.includes('+ 외 '));

      // Check compare button (max 20 chars limit)
      const buttonBlock = payload.blocks.find((b) => b.type === 'button');
      assert.equal(buttonBlock?.text, '🔍 변경사항 확인');
      assert.ok(buttonBlock?.text.length <= 20);
      assert.equal(buttonBlock?.action_type, 'open_inapp_browser');
      assert.equal(buttonBlock?.value, event.compare);
    });

    it('dev가 아닌 다른 브랜치의 push 이벤트는 null을 반환해야 한다', () => {
      const event = {
        ref: 'refs/heads/feat/some-feature',
        commits: [],
      };
      const payload = buildKakaoWorkPayload('push', event);
      assert.equal(payload, null);
    });
  });

  describe('pull_request event', () => {
    it('main 대상 PR opened 이벤트 시 올바른 블록킷 메시지를 생성해야 한다', () => {
      const event = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'feat: 바이어 관리 백오피스 개선',
          html_url: 'https://github.com/Jun-pepsi-limeflavor/medi-da-kos/pull/42',
          user: { login: 'giwook' },
          head: { ref: 'dev' },
          base: { ref: 'main' },
          merged: false,
        },
      };

      const payload = buildKakaoWorkPayload('pull_request', event);
      assert.ok(payload);
      assert.ok(payload.text.includes('[PR #42] 풀 리퀘스트 등록'));

      const headerBlock = payload.blocks.find((b) => b.type === 'header');
      assert.equal(headerBlock?.text, '📬 [PR #42] PR 등록');
      assert.equal(headerBlock?.style, 'yellow');

      const buttonBlock = payload.blocks.find((b) => b.type === 'button');
      assert.equal(buttonBlock?.text, '👉 PR 검토 및 확인하기');
      assert.equal(buttonBlock?.value, event.pull_request.html_url);
    });

    it('main 대상 PR reopened 이벤트 시 올바른 블록킷 메시지를 생성해야 한다', () => {
      const event = {
        action: 'reopened',
        pull_request: {
          number: 42,
          title: 'feat: 바이어 관리 백오피스 개선',
          html_url: 'https://github.com/Jun-pepsi-limeflavor/medi-da-kos/pull/42',
          user: { login: 'giwook' },
          head: { ref: 'dev' },
          base: { ref: 'main' },
          merged: false,
        },
      };

      const payload = buildKakaoWorkPayload('pull_request', event);
      assert.ok(payload);
      assert.ok(payload.text.includes('[PR #42] 풀 리퀘스트 재오픈'));

      const headerBlock = payload.blocks.find((b) => b.type === 'header');
      assert.equal(headerBlock?.text, '📬 [PR #42] PR 재오픈');
    });

    it('main 대상 PR closed & merged 이벤트 시 머지 알림 메시지를 생성해야 한다', () => {
      const event = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'feat: 바이어 관리 백오피스 개선',
          html_url: 'https://github.com/Jun-pepsi-limeflavor/medi-da-kos/pull/42',
          user: { login: 'developer1' },
          merged_by: { login: 'giwook' },
          head: { ref: 'dev' },
          base: { ref: 'main' },
          merged: true,
        },
      };

      const payload = buildKakaoWorkPayload('pull_request', event);
      assert.ok(payload);
      assert.ok(payload.text.includes('[PR #42] main 브랜치 머지 완료'));

      const headerBlock = payload.blocks.find((b) => b.type === 'header');
      assert.equal(headerBlock?.text, '🎉 [PR #42] main 머지');
      assert.equal(headerBlock?.style, 'blue');

      const buttonBlock = payload.blocks.find((b) => b.type === 'button');
      assert.equal(buttonBlock?.text, '🔍 머지된 PR 내역 보기');
      assert.equal(buttonBlock?.value, event.pull_request.html_url);
    });

    it('main 대상 PR closed 이벤트이지만 merged가 false인 경우 null을 반환해야 한다', () => {
      const event = {
        action: 'closed',
        pull_request: {
          number: 42,
          title: 'test',
          merged: false,
          base: { ref: 'main' },
        },
      };

      const payload = buildKakaoWorkPayload('pull_request', event);
      assert.equal(payload, null);
    });

    it('main이 아닌 다른 base 브랜치를 향한 PR은 null을 반환해야 한다', () => {
      const event = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'test',
          base: { ref: 'feat/test' },
        },
      };

      const payload = buildKakaoWorkPayload('pull_request', event);
      assert.equal(payload, null);
    });
  });
});

describe('resolveConversationId', () => {
  it('대화방 목록에서 지정된 이름의 대화방 ID를 찾아 반환해야 한다', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        conversations: [
          { id: 'conv_1', name: '일반' },
          { id: 'conv_2', name: '마케팅-medidakos' },
        ],
      }),
    });

    const conversationId = await resolveConversationId('mock_app_key', '마케팅-medidakos', mockFetch);
    assert.equal(conversationId, 'conv_2');
  });

  it('대화방이 없으면 null을 반환해야 한다', async () => {
    const mockFetch = async () => ({
      ok: true,
      json: async () => ({
        success: true,
        conversations: [{ id: 'conv_1', name: '다른방' }],
      }),
    });

    const conversationId = await resolveConversationId('mock_app_key', '마케팅-medidakos', mockFetch);
    assert.equal(conversationId, null);
  });
});

describe('sendKakaoWorkMessage', () => {
  it('App Key 및 Webhook URL이 모두 없으면 에러를 발생시켜야 한다', async () => {
    await assert.rejects(
      async () => {
        await sendKakaoWorkMessage('', { text: 'test' });
      },
      /KAKAOWORK_APP_KEY or KAKAOWORK_WEBHOOK_URL is required/
    );
  });

  it('Webhook URL 방식: 올바른 페이로드를 전달하여 fetch POST를 호출해야 한다', async () => {
    let calledUrl = '';
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 200,
        text: async () => '{"success":true}',
      };
    };

    const webhookUrl = 'https://api.kakaowork.com/v1/webhooks/mock_test';
    const payload = { text: 'Test message', blocks: [] };

    const result = await sendKakaoWorkMessage(webhookUrl, payload, mockFetch);
    assert.equal(result.ok, true);
    assert.equal(calledUrl, webhookUrl);
    assert.equal(calledOptions?.method, 'POST');
    assert.equal(calledOptions?.headers?.['Content-Type'], 'application/json');
    assert.equal(calledOptions?.body, JSON.stringify(payload));
  });

  it('Bot App Key 방식: conversation_id를 포함하여 messages.send를 호출해야 한다', async () => {
    let calledUrl = '';
    let calledOptions = null;

    const mockFetch = async (url, options) => {
      calledUrl = url;
      calledOptions = options;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, message: { id: 'msg_123' } }),
      };
    };

    const config = {
      appKey: 'ca5d4dec.70314c0bf13641aebc8c2e3cab0a0902',
      conversationId: '1014370109825038',
    };
    const payload = { text: 'Test bot message', blocks: [] };

    const result = await sendKakaoWorkMessage(config, payload, mockFetch);
    assert.equal(result.ok, true);
    assert.equal(calledUrl, 'https://api.kakaowork.com/v1/messages.send');
    assert.equal(calledOptions?.headers?.Authorization, 'Bearer ca5d4dec.70314c0bf13641aebc8c2e3cab0a0902');
    const body = JSON.parse(calledOptions?.body);
    assert.equal(body.conversation_id, '1014370109825038');
    assert.equal(body.text, payload.text);
  });
});
