import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isInternalAddress,
  extractEmailAddress,
  isForwardedSubject,
  isInternalStaffThread,
} from "../src/lib/internal-staff.ts";

describe("Internal Staff and Forwarding Classification", () => {
  it("extractEmailAddress: 발신자 문자열에서 순수 이메일 추출", () => {
    assert.equal(
      extractEmailAddress("Thomas <thomas@medidakoslabs.com>"),
      "thomas@medidakoslabs.com",
    );
    assert.equal(
      extractEmailAddress("hally@medidakoslabs.com"),
      "hally@medidakoslabs.com",
    );
    assert.equal(
      extractEmailAddress("  songjh@techasset.co.kr  "),
      "songjh@techasset.co.kr",
    );
  });

  it("isInternalAddress: 사내 도메인 및 직원 계정 정확히 판별", () => {
    // 사내 계정
    assert.equal(isInternalAddress("thomas@medidakoslabs.com"), true);
    assert.equal(isInternalAddress("hally@medidakoslabs.com"), true);
    assert.equal(isInternalAddress("rheekw@techasset.co.kr"), true);
    assert.equal(isInternalAddress("admin@medidakos.com"), true);
    assert.equal(isInternalAddress("thomas"), true);
    assert.equal(isInternalAddress("Hally Kim <hally@medidakoslabs.com>"), true);

    // 외부 계정
    assert.equal(isInternalAddress("jade@aussiebeauty.com"), false);
    assert.equal(isInternalAddress("buyer@brand.com"), false);
    assert.equal(isInternalAddress("supplier@factory.co.kr"), false);
    assert.equal(isInternalAddress("random.person@gmail.com"), false);
  });

  it("isForwardedSubject: 포워딩 제목 감지", () => {
    assert.equal(
      isForwardedSubject("Fwd: A note from Korea, for the Kinoko Labs team"),
      true,
    );
    assert.equal(isForwardedSubject("FW: 바이어 견적 문의 전달"), true);
    assert.equal(isForwardedSubject("[Fwd: 견적서 공유]"), true);
    assert.equal(isForwardedSubject("전달: OEM 생산 일정 확인"), true);
    assert.equal(isForwardedSubject("Re: Sample delivery date"), false);
    assert.equal(isForwardedSubject("Inquiry for OEM sunscreen"), false);
  });

  it("isInternalStaffThread: 직원 간 대화 및 포워딩 스레드 감지", () => {
    // 1. Thomas가 Hally에게 포워딩한 메일 (사진 사례)
    const forwardingThread = {
      channel: "gmail_hally",
      sourceAccount: "hally@medidakoslabs.com",
      side: "brand",
    };
    const forwardingMessage = {
      from: "thomas@medidakoslabs.com",
      fromName: "thomas",
      subject: "Fwd: A note from Korea, for the Kinoko Labs team",
    };
    assert.equal(
      isInternalStaffThread(forwardingThread, forwardingMessage),
      true,
    );

    // 2. 외부 바이어가 Hally에게 보낸 정상 문의 -> false
    const buyerThread = {
      channel: "gmail_hally",
      sourceAccount: "hally@medidakoslabs.com",
      side: "brand",
    };
    const buyerMessage = {
      from: "jade@aussiebeauty.com",
      fromName: "Jade Davis",
      subject: "OEM Production Request",
    };
    assert.equal(isInternalStaffThread(buyerThread, buyerMessage), false);

    // 3. 사내 직원 간의 일반 대화 -> true
    const internalChat = {
      channel: "gmail_thomas",
      sourceAccount: "thomas@medidakoslabs.com",
      side: "brand",
    };
    const internalMessage = {
      from: "rheekw@techasset.co.kr",
      fromName: "이관우",
      subject: "공장 미팅 안건 공유",
    };
    assert.equal(isInternalStaffThread(internalChat, internalMessage), true);
  });
});
