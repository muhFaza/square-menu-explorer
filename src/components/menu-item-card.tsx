"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { CupIcon, HeartIcon, HeartSolidIcon } from "@/components/icons";
import { useFavorites } from "@/hooks/use-favorites";
import { formatCatalogMoney } from "@/lib/client/money";
import type {
  CatalogItemDto,
  CatalogMoneyDto,
  CatalogVariationDto,
} from "@/types/catalog";

function Price({ price }: { readonly price: CatalogMoneyDto | null }) {
  return price === null ? (
    <span className="menu-price menu-price--missing">Price unavailable</span>
  ) : (
    <span className="menu-price">{formatCatalogMoney(price)}</span>
  );
}

/** Lowest-priced variation, or null when no variation carries a price. */
function lowestPricedVariation(
  variations: readonly CatalogVariationDto[],
): CatalogVariationDto | null {
  return variations.reduce<CatalogVariationDto | null>((lowest, variation) => {
    if (variation.price === null) {
      return lowest;
    }
    if (lowest === null || lowest.price === null) {
      return variation;
    }
    return BigInt(variation.price.amount) < BigInt(lowest.price.amount)
      ? variation
      : lowest;
  }, null);
}

function FromPrice({ item }: { readonly item: CatalogItemDto }) {
  const lowest = lowestPricedVariation(item.variations);
  if (lowest === null || lowest.price === null) {
    return (
      <p className="menu-card__from menu-card__from--missing">
        <Price price={null} />
      </p>
    );
  }

  // A single variation shows its exact price; multiple show a "From" floor.
  const prefix = item.variations.length > 1 ? "From " : "";
  return (
    <p className="menu-card__from">
      {prefix}
      <span className="menu-price">{formatCatalogMoney(lowest.price)}</span>
    </p>
  );
}

export function MenuItemCard({ item }: { readonly item: CatalogItemDto }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflows, setDescriptionOverflows] = useState(false);
  const [favoriteAnnouncement, setFavoriteAnnouncement] = useState("");
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(item.id);
  const descriptionId = useId();
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const showImage = item.image_url !== null && !imageFailed;

  const handleToggleFavorite = () => {
    setFavoriteAnnouncement(
      favorited
        ? `Removed ${item.name} from favorites`
        : `Added ${item.name} to favorites`,
    );
    toggleFavorite(item.id);
  };

  const measureDescriptionOverflow = useCallback(() => {
    const description = descriptionRef.current;
    if (description === null || descriptionExpanded) {
      return;
    }

    setDescriptionOverflows(
      description.scrollHeight > description.clientHeight + 1,
    );
  }, [descriptionExpanded]);

  useLayoutEffect(() => {
    measureDescriptionOverflow();
  }, [item.description, measureDescriptionOverflow]);

  useEffect(() => {
    const description = descriptionRef.current;
    if (description === null) {
      return;
    }

    const resizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(measureDescriptionOverflow)
        : null;
    resizeObserver?.observe(description);
    window.addEventListener("resize", measureDescriptionOverflow);

    const fontSet = document.fonts;
    fontSet?.addEventListener("loadingdone", measureDescriptionOverflow);
    void fontSet?.ready.then(measureDescriptionOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureDescriptionOverflow);
      fontSet?.removeEventListener("loadingdone", measureDescriptionOverflow);
    };
  }, [measureDescriptionOverflow]);

  return (
    <article className="menu-card">
      <div className="menu-card__image">
        {showImage ? (
          <Image
            alt=""
            fill
            onError={() => setImageFailed(true)}
            sizes="(max-width: 700px) 112px, (max-width: 1100px) 30vw, 280px"
            src={item.image_url!}
            unoptimized
          />
        ) : (
          <div
            aria-label={`No image available for ${item.name}`}
            className="menu-card__image-fallback"
            role="img"
          >
            <span aria-hidden="true" className="menu-card__image-fallback-mark">
              <CupIcon size={26} />
            </span>
          </div>
        )}
      </div>
      {/* Direct card child so mobile can move the heart to the card's bottom-right. */}
      <button
        aria-label={
          favorited
            ? `Remove ${item.name} from favorites`
            : `Add ${item.name} to favorites`
        }
        aria-pressed={favorited}
        className={`menu-card__favorite${favorited ? " is-favorited" : ""}`}
        onClick={handleToggleFavorite}
        type="button"
      >
        {favorited ? <HeartSolidIcon size={18} /> : <HeartIcon size={18} />}
      </button>
      <span aria-live="polite" className="sr-only">
        {favoriteAnnouncement}
      </span>

      <div className="menu-card__body">
        <h3 className="menu-card__name">{item.name}</h3>
        {item.description ? (
          <p
            className={`menu-card__description${descriptionExpanded ? " is-expanded" : ""}`}
            id={descriptionId}
            ref={descriptionRef}
          >
            {item.description}
          </p>
        ) : (
          <p className="menu-card__description menu-card__description--missing">
            No description available.
          </p>
        )}
        {descriptionOverflows ? (
          <button
            aria-controls={descriptionId}
            aria-expanded={descriptionExpanded}
            className="description-toggle"
            onClick={() => setDescriptionExpanded((expanded) => !expanded)}
            type="button"
          >
            {descriptionExpanded ? "Show less" : "Read more"}
          </button>
        ) : null}
        <FromPrice item={item} />
        {/* A lone variation carries no choice: FromPrice already shows its exact
            price, so listing it again just repeats the same line. */}
        {item.variations.length > 1 ? (
          <ul
            className="variation-list"
            aria-label={`Variations for ${item.name}`}
          >
            {item.variations.map((variation) => (
              <li key={variation.id}>
                <span>{variation.name}</span>
                <Price price={variation.price} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
