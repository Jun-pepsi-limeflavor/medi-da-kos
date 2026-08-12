/**
 * <scroll-carousel> — 가로 스크롤 영역을 감싸는 커스텀 엘리먼트.
 *
 * 참고한 dyou.co가 같은 태그 이름을 쓴다. React 컴포넌트로도 같은 화면은
 * 나오지만 커스텀 엘리먼트로 두면 얻는 게 둘 있다.
 *
 * 1. `is-scrollable`이 실제 넘침 여부로 붙는다. 카드가 다 들어오는 넓은 화면에서
 *    잡아끌기·페이드를 자동으로 끈다 — 스크롤할 게 없는데 잡히는 커서는 거짓말이다.
 * 2. 스크롤 상태(`--progress`)를 CSS 변수로 내보내 스타일 쪽에서 쓰게 한다.
 *    JS가 색·투명도를 직접 만지지 않아 리페인트가 CSS 안에 갇힌다.
 *
 * 클래스 본문이 이 함수 안에 있는 이유 — `extends HTMLElement`는 평가 시점에
 * 그 전역을 요구한다. 모듈 최상위에 두면 클라이언트 컴포넌트라도 서버 렌더에서
 * 함께 평가돼 "HTMLElement is not defined"로 죽는다.
 *
 * 접근성: 이 요소는 tabindex를 갖지 않는다. 카드 안 링크로 탭 이동이 되면
 * 브라우저가 알아서 가로로 스크롤해 주고, 빈 컨테이너에 포커스를 두면
 * 스크린리더 사용자에게 목적 없는 정거장이 하나 생긴다.
 */
export const SCROLL_CAROUSEL_TAG = "scroll-carousel";

/** 클라이언트에서 1회. 중복 정의는 예외를 던지므로 먼저 확인한다. */
export function defineScrollCarousel() {
  if (typeof window === "undefined") return;
  if (customElements.get(SCROLL_CAROUSEL_TAG)) return;

  class ScrollCarousel extends HTMLElement {
    #observer?: ResizeObserver;
    #dragging = false;
    #startX = 0;
    #startScroll = 0;
    /** 드래그가 6px을 넘긴 뒤에야 클릭을 삼킨다. 그냥 누른 건 링크로 통과. */
    #moved = false;

    connectedCallback() {
      this.#sync();

      this.addEventListener("scroll", this.#onScroll, { passive: true });
      this.addEventListener("pointerdown", this.#onPointerDown);
      this.addEventListener("click", this.#onClick, true);

      this.#observer = new ResizeObserver(() => this.#sync());
      this.#observer.observe(this);
      for (const child of Array.from(this.children)) {
        this.#observer.observe(child);
      }
    }

    disconnectedCallback() {
      this.removeEventListener("scroll", this.#onScroll);
      this.removeEventListener("pointerdown", this.#onPointerDown);
      this.removeEventListener("click", this.#onClick, true);
      this.#endDrag();
      this.#observer?.disconnect();
    }

    #sync() {
      // 1px은 소수점 레이아웃 오차. 이걸 안 빼면 딱 맞는 폭에서도 참이 된다.
      this.classList.toggle(
        "is-scrollable",
        this.scrollWidth - this.clientWidth > 1,
      );
      this.#syncProgress();
    }

    #syncProgress() {
      const max = this.scrollWidth - this.clientWidth;
      const progress = max > 0 ? String(this.scrollLeft / max) : "0";
      this.style.setProperty("--progress", progress);
      // 끝단 페이드는 이 요소를 덮는 부모의 ::after가 그린다. CSS 변수는
      // 아래로만 흐르므로 부모에 한 번 더 써준다 — 부모가 자식 값을 읽을 방법이 없다.
      this.parentElement?.style.setProperty("--carousel-progress", progress);
    }

    #onScroll = () => {
      this.#syncProgress();
    };

    #onPointerDown = (event: PointerEvent) => {
      // 마우스만. 터치·펜은 네이티브 스크롤이 이미 더 낫다.
      if (
        event.pointerType !== "mouse" ||
        !this.classList.contains("is-scrollable")
      ) {
        return;
      }
      this.#dragging = true;
      this.#moved = false;
      this.#startX = event.clientX;
      this.#startScroll = this.scrollLeft;
      this.classList.add("is-dragging");
      window.addEventListener("pointermove", this.#onPointerMove);
      window.addEventListener("pointerup", this.#endDrag);
      window.addEventListener("pointercancel", this.#endDrag);
    };

    #onPointerMove = (event: PointerEvent) => {
      if (!this.#dragging) return;
      const delta = event.clientX - this.#startX;
      if (Math.abs(delta) > 6) this.#moved = true;
      this.scrollLeft = this.#startScroll - delta;
    };

    #endDrag = () => {
      if (!this.#dragging) return;
      this.#dragging = false;
      this.classList.remove("is-dragging");
      window.removeEventListener("pointermove", this.#onPointerMove);
      window.removeEventListener("pointerup", this.#endDrag);
      window.removeEventListener("pointercancel", this.#endDrag);
    };

    /** 끌어서 놓은 직후의 클릭은 링크 이동이 아니다. */
    #onClick = (event: MouseEvent) => {
      if (!this.#moved) return;
      event.preventDefault();
      event.stopPropagation();
      this.#moved = false;
    };
  }

  customElements.define(SCROLL_CAROUSEL_TAG, ScrollCarousel);
}
