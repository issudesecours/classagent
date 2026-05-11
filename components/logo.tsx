import Link from "next/link";
import Image from "next/image";
import clsx from "clsx";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  className?: string;
  variant?: "light" | "dark" | "auto";
}

export function Logo({ size = "md", showText = false, href = "/", className }: LogoProps) {
  const sizes = {
    sm: { img: "h-14 w-auto", text: "text-sm" },
    md: { img: "h-20 w-auto", text: "text-base" },
    lg: { img: "h-24 w-auto", text: "text-lg" },
  };

  const content = (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="Villa Sahrai"
        width={160}
        height={160}
        className={clsx("object-contain", sizes[size].img)}
      />
      {showText && (
        <span className={clsx("font-semibold tracking-wide text-sahrai-900 dark:text-sahrai-100", sizes[size].text)}>
          Villa Sahrai
        </span>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
