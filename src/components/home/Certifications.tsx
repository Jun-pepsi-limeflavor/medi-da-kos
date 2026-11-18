// Home 4 · Partner Certifications & Compliance Support.
// - 인증 마크 8개(Figma 원본 순서·크롭 그대로)와 Services 품질·규제 섹션 링크
// - 데스크톱 한 줄 8개, 태블릿 4열, 모바일 2열
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { SERVICES_SECTIONS } from "@/lib/config/routes";
import { EYEBROW, SECTION_CONTAINER } from "@/components/home/styles";

/**
 * Figma: 4 · Partner Certifications & Compliance Support (234:5343).
 * Each logo sits centered in a 140×84 box; `crop` reproduces the Figma image fill offsets (% of the logo frame).
 */
const MARKS = [
  { name: "FDA", file: "fda.png", w: 98.02, h: 43.16, crop: { l: -0.66, t: -68.09, w: 101.99, h: 236.74 } },
  { name: "EU CPNP", file: "eu-cpnp.png", w: 64.48, h: 65.52, crop: { l: -15.26, t: -4.44, w: 128.27, h: 109.89 } },
  { name: "ISO 22716", file: "iso-22716.png", w: 63.83, h: 66.17, crop: { l: -16.83, t: -8.68, w: 130.48, h: 114.63 } },
  { name: "ISO 9001", file: "iso-9001.png", w: 63.83, h: 66.17, crop: { l: -38.5, t: -15.54, w: 308.5, h: 136.22 } },
  { name: "MFDS", file: "mfds.png", w: 66.17, h: 63.83, crop: { l: -12.8, t: -9.92, w: 124.4, h: 116.12 } },
  { name: "ISO 14001", file: "iso-14001.png", w: 67.86, h: 62.27, crop: { l: -4.04, t: -8.36, w: 107.74, h: 116.36 } },
  { name: "GMP", file: "gmp.png", w: 64.48, h: 65.52, crop: { l: -3.16, t: -1.94, w: 237.55, h: 103.49 } },
  { name: "GMPC", file: "gmpc.png", w: 64.48, h: 65.65, crop: { l: -21.31, t: -9.18, w: 140.55, h: 122.79 } },
] as const;

export function Certifications() {
  return (
    <section className="bg-mdk-white py-16 lg:py-[100px]">
      <div className={`${SECTION_CONTAINER} flex flex-col gap-10 lg:gap-12`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className={EYEBROW}>Certifications &amp; Compliance Support</h2>
          <Button href={SERVICES_SECTIONS.qualityCompliance} variant="secondary" size="s">
            Quality &amp; compliance →
          </Button>
        </div>
        <ul className="grid grid-cols-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-8">
          {MARKS.map(({ name, file, w, h, crop }) => (
            <li key={name} className="flex flex-col items-center gap-3 py-3">
              <div className="relative flex h-[84px] w-[140px] max-w-full items-center justify-center overflow-hidden">
                <div className="relative overflow-hidden" style={{ width: w, height: h }}>
                  <div
                    className="absolute"
                    style={{ left: `${crop.l}%`, top: `${crop.t}%`, width: `${crop.w}%`, height: `${crop.h}%` }}
                  >
                    <Image src={`/logos/certifications/${file}`} alt="" fill sizes="200px" />
                  </div>
                </div>
              </div>
              <p className="text-[13px] leading-[18px] font-medium text-mdk-charcoal-muted">{name}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
