import clsx from "clsx";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
}

const sizeClasses = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-6",
};

const textSizeClasses = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

function StarIcon({
  filled,
  half,
  className,
}: {
  filled: boolean;
  half: boolean;
  className?: string;
}) {
  if (half) {
    return (
      <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
        <defs>
          <linearGradient id="half-star">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path
          fill="url(#half-star)"
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 20 20"
      className={clsx(className, filled ? "text-amber-400" : "text-zinc-200 dark:text-zinc-600")}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export function StarRating({ rating, size = "sm", showValue }: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
  const roundedUp = rating - fullStars >= 0.75;

  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => {
        const isFilled = i < fullStars || (roundedUp && i === fullStars);
        const isHalf = hasHalf && i === fullStars;
        return (
          <StarIcon
            key={i}
            filled={isFilled}
            half={isHalf}
            className={clsx(sizeClasses[size], isHalf ? "text-amber-400" : undefined)}
          />
        );
      })}
      {showValue && (
        <span className={clsx("ml-1 font-medium text-zinc-700 dark:text-zinc-300", textSizeClasses[size])}>
          {rating.toFixed(1)}
        </span>
      )}
    </span>
  );
}
