import { NextResponse } from 'next/server';

/**
 * 카카오워크 봇 Request URL 및 Callback URL 처리 엔드포인트
 * - 카카오워크 콘솔 인증 요청 (GET / POST / HEAD) 시 200 OK 반환
 * - 봇 인터랙션(버튼 클릭, 모달 제출 등) 수신 시 응답 처리
 */
export async function GET() {
  return NextResponse.json({ success: true, message: 'KakaoWork Bot Callback Endpoint Ready' });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    console.log('[KakaoWork Callback Received]', body);

    return NextResponse.json({
      success: true,
      message: 'OK',
    });
  } catch (error) {
    console.error('[KakaoWork Callback Error]', error);
    return NextResponse.json({ success: false, error: 'Internal Error' }, { status: 500 });
  }
}
