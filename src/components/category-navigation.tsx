import { useRef, useState } from "react";

import { CategoryIcon } from "@/components/category-icon";
import { HomeIcon } from "@/components/icons";
import type { CatalogCategorySummaryDto } from "@/types/catalog";

interface CategoryNavigationProps {
  readonly activeCategoryId: string;
  readonly categories: readonly CatalogCategorySummaryDto[];
  readonly onSelect: (categoryId: string) => void;
}

export const ALL_ITEMS_CATEGORY_ID = "all-items";

export function CategoryNavigation({
  activeCategoryId,
  categories,
  onSelect,
}: CategoryNavigationProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [tabStopIndex, setTabStopIndex] = useState(0);
  const totalItemCount = categories.reduce(
    (total, category) => total + category.item_count,
    0,
  );
  const options = [
    { id: ALL_ITEMS_CATEGORY_ID, item_count: totalItemCount, name: "All items" },
    ...categories,
  ];

  const focusOption = (index: number) => {
    setTabStopIndex(index);
    buttonRefs.current[index]?.focus();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = options.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      focusOption(nextIndex);
    }
  };

  return (
    <nav aria-label="Menu categories">
      <ul className="category-navigation">
        {options.map((category, index) => (
          <li key={category.id}>
            <button
              aria-pressed={activeCategoryId === category.id}
              className={
                activeCategoryId === category.id ? "is-active" : undefined
              }
              onClick={() => {
                setTabStopIndex(index);
                onSelect(category.id);
              }}
              onFocus={() => setTabStopIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              ref={(button) => {
                buttonRefs.current[index] = button;
              }}
              tabIndex={tabStopIndex === index ? 0 : -1}
              type="button"
            >
              <span aria-hidden="true" className="category-navigation__icon">
                {category.id === ALL_ITEMS_CATEGORY_ID ? (
                  <HomeIcon size={18} />
                ) : (
                  <CategoryIcon name={category.name} size={18} />
                )}
              </span>
              <span className="category-navigation__name">{category.name}</span>
              <span
                aria-label={`${category.item_count} items`}
                className="category-navigation__count"
              >
                {category.item_count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
