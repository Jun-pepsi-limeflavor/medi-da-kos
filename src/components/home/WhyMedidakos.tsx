// Home 3 · Why Medidakos.
// - 왼쪽 이미지 카드 + 오른쪽 텍스트 카드(Eyebrow·제목·본문·Services 관리 범위 링크)
// - lg 미만은 이미지 위, 텍스트 아래로 쌓는다
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { SERVICES_SECTIONS } from "@/lib/config/routes";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/** Figma: 3 · Why Medidakos — image-led strengths (234:5321). */
export function WhyMedidakos() {
  return (
    <section className="bg-mdk-white py-16 lg:py-30">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-6 lg:flex-row`}>
        <div className="relative aspect-[500/640] w-full overflow-hidden rounded-mdk-lg sm:aspect-[4/3] lg:aspect-auto lg:h-[640px] lg:w-[500px] lg:shrink-0">
          <Image
            src="/images/home/why-medidakos.png"
            alt=""
            fill
            sizes="(min-width: 1024px) 500px, 100vw"
            className="object-cover object-[78%_50%]"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-16 rounded-mdk-lg bg-mdk-off-white p-6 sm:p-10 lg:h-[640px] lg:p-16">
          <h2 className={EYEBROW}>Why Medidakos</h2>
          <div className="flex flex-col items-start gap-10">
            <div className="flex flex-col gap-6">
              <p className="text-[36px] leading-[40px] font-semibold tracking-[-0.035em] text-mdk-charcoal lg:text-[52px] lg:leading-[54px]">
                One expert partner
                <br />
                from concept to launch
              </p>
              <p className="text-[18px] leading-[28px] tracking-[-0.005em] text-mdk-charcoal">
                Work with one expert partner throughout your project. Your dedicated PM specializes in cosmetics
                development and coordinates every supplier from concept to launch, so you can focus on your brand.
              </p>
            </div>
            <Button href={SERVICES_SECTIONS.scope} variant="secondary">
              See what we manage →
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
