import {
  BowlIcon,
  CakeIcon,
  CroissantIcon,
  CupIcon,
  GlassIcon,
  type IconProps,
  LeafIcon,
  PlateIcon,
  SaladIcon,
  SandwichIcon,
  SunIcon,
} from "@/components/icons";

// Maps a category name to an icon by the first matching keyword rule.
export function CategoryIcon({
  name,
  ...props
}: IconProps & { readonly name: string }) {
  const normalized = name.toLowerCase();

  if (/coffee|espresso|latte|cappuccino|mocha|americano|brew/.test(normalized)) {
    return <CupIcon {...props} />;
  }
  if (/tea|chai|matcha/.test(normalized)) {
    return <LeafIcon {...props} />;
  }
  if (/pastr|croissant|bakery|bread|muffin|scone|donut|bagel|roll/.test(normalized)) {
    return <CroissantIcon {...props} />;
  }
  if (/breakfast|brunch|morning/.test(normalized)) {
    return <SunIcon {...props} />;
  }
  if (/sandwich|panini|wrap|toast|burger|sub\b/.test(normalized)) {
    return <SandwichIcon {...props} />;
  }
  if (/salad|green/.test(normalized)) {
    return <SaladIcon {...props} />;
  }
  if (/bowl|rice|noodle|soup|grain/.test(normalized)) {
    return <BowlIcon {...props} />;
  }
  if (/dessert|cake|cookie|sweet|ice cream|pie|treat/.test(normalized)) {
    return <CakeIcon {...props} />;
  }
  if (/beverage|drink|juice|soda|smoothie|cola|lemonade/.test(normalized)) {
    return <GlassIcon {...props} />;
  }
  return <PlateIcon {...props} />;
}
