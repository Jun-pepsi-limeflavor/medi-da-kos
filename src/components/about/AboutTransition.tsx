// About Us 3a · Transition. 어두운 배경이라 data-launcher-theme="dark"(Channel Talk 런처가 이 위에서 On Dark 색으로 바뀜).
// - 차콜 배경 가운데 정렬 질문(Display L, 최대 960px)과 보조 문장. 버튼·인터랙션 없음
// - 1440 제목 행간은 Figma 72/72 (공통 제목의 md 행간 58px이 lg까지 이어지지 않게 지정)
import { DISPLAY_TITLE, SECTION_CONTAINER } from "@/components/home/styles";
import { cx } from "@/lib/utils/cx";

/** Figma: 3a · Transition — one partner? (458:883). Confirmed copy. */
export function AboutTransition() {
  return (
    <section data-launcher-theme="dark" className="bg-mdk-charcoal py-24 lg:py-44">
      <div className={`${SECTION_CONTAINER} flex flex-col items-center gap-7 text-center`}>
        <h2 className={cx(DISPLAY_TITLE, "max-w-[960px] text-mdk-white lg:leading-[72px]")}>
          What if one partner could bring it all together?
        </h2>
        <p className="max-w-[640px] text-[20px] leading-[30px] text-mdk-light-gray">
          Medidakos exists to be that partner for global beauty brands.
        </p>
      </div>
    </section>
  );
}
