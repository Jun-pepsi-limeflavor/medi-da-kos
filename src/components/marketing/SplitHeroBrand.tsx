type SplitHeroBrandProps = {
  title: string;
  leftTagline: string;
  rightTagline: string;
};

function BrandMark({ title, className }: { title: string; className: string }) {
  return (
    <p
      className={`whitespace-nowrap font-serif text-[clamp(1.75rem,4.5vw,3.5rem)] font-semibold leading-none tracking-[-0.02em] ${className}`}
    >
      {title}
    </p>
  );
}

function BrandColumn({
  title,
  tagline,
  anchorClass,
  titleClassName,
  taglineClassName,
}: {
  title: string;
  tagline: string;
  anchorClass: string;
  titleClassName: string;
  taglineClassName: string;
}) {
  return (
    <div
      className={`absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center ${anchorClass}`}
    >
      <BrandMark title={title} className={titleClassName} />
      <p
        className={`mt-3 max-w-[min(38vw,14rem)] font-serif text-[9px] font-normal leading-snug tracking-[0.02em] sm:mt-4 sm:max-w-[min(32vw,15rem)] sm:text-[10px] sm:tracking-[0.03em] ${taglineClassName}`}
      >
        {tagline}
      </p>
    </div>
  );
}

/**
 * Dual brand marks at the 1/4 and 3/4 width anchors — white left, black right.
 */
export function SplitHeroBrand({
  title,
  leftTagline,
  rightTagline,
}: SplitHeroBrandProps) {
  return (
    <div className="pointer-events-none relative w-full">
      <BrandColumn
        title={title}
        tagline={leftTagline}
        anchorClass="left-1/4"
        titleClassName="text-white drop-shadow-[0_2px_20px_rgba(0,0,0,0.35)]"
        taglineClassName="text-white/75 drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)]"
      />
      <BrandColumn
        title={title}
        tagline={rightTagline}
        anchorClass="left-3/4"
        titleClassName="text-slate-900"
        taglineClassName="text-slate-500"
      />

      <p className="sr-only">
        {title}. {leftTagline} {rightTagline}
      </p>
    </div>
  );
}
