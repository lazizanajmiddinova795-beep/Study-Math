import { brand, brandMonogram } from "@/lib/config/brand";

export function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 text-xl" : "h-8 w-8 text-base";
  return (
    <span className="flex items-center gap-2.5">
      {brand.logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoSrc} alt="" className={box} />
      ) : (
        <span
          aria-hidden
          className={`${box} flex items-center justify-center rounded-lg bg-primary-600 font-semibold text-white`}
        >
          {brandMonogram()}
        </span>
      )}
      <span className="font-semibold tracking-tight text-ink">{brand.name}</span>
    </span>
  );
}
