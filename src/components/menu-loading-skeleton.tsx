export function CategoryNavigationSkeleton() {
  return (
    <div aria-hidden="true" className="category-skeleton">
      {[72, 58, 66, 52, 60].map((width) => (
        <div className="category-skeleton__row" key={width}>
          <span className="category-skeleton__icon" />
          <span
            className="category-skeleton__label"
            style={{ width: `${width}%` }}
          />
          <span className="category-skeleton__badge" />
        </div>
      ))}
    </div>
  );
}

export function MenuLoadingSkeleton() {
  return (
    <div aria-hidden="true" className="menu-loading-skeleton">
      <div className="menu-loading-skeleton__header">
        <span className="menu-loading-skeleton__eyebrow" />
        <span className="menu-loading-skeleton__title" />
        <span className="menu-loading-skeleton__subtitle" />
      </div>
      <div className="menu-loading-skeleton__section-heading">
        <span className="menu-loading-skeleton__section-icon" />
        <span className="menu-loading-skeleton__section-title" />
      </div>
      <div className="menu-loading-skeleton__grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="menu-loading-skeleton__card" key={index}>
            <span className="menu-loading-skeleton__image" />
            <div className="menu-loading-skeleton__copy">
              <span className="menu-loading-skeleton__name" />
              <span className="menu-loading-skeleton__line" />
              <span className="menu-loading-skeleton__line menu-loading-skeleton__line--short" />
              <span className="menu-loading-skeleton__price" />
              <div className="menu-loading-skeleton__chips">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
