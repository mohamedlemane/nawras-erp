// Styles react-select — approche unstyled + classNames Tailwind (CSS v4)
// Usage: <ReactSelect unstyled classNames={rsClassNames} styles={rsPortalStyles} ... />

export const rsClassNames = {
  control: ({ isFocused }: { isFocused: boolean }) =>
    [
      "flex min-h-9 w-full rounded-md border bg-background px-1 py-0.5 text-sm transition-colors cursor-default",
      isFocused
        ? "border-ring ring-2 ring-ring/20 outline-none"
        : "border-input hover:border-ring/50",
    ].join(" "),
  placeholder: () => "text-muted-foreground text-sm px-2",
  input: () => "text-foreground text-sm px-2",
  singleValue: () => "text-foreground text-sm px-2",
  valueContainer: () => "flex flex-wrap gap-1 items-center",
  indicatorSeparator: () => "bg-border mx-1 w-px self-stretch",
  dropdownIndicator: () => "text-muted-foreground hover:text-foreground px-2",
  clearIndicator: () => "text-muted-foreground hover:text-destructive px-1 cursor-pointer",
  menu: () =>
    "mt-1 rounded-md border border-border bg-popover shadow-md text-sm z-50",
  menuList: () => "py-1",
  option: ({ isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) =>
    [
      "px-3 py-2 cursor-pointer",
      isSelected
        ? "bg-primary text-primary-foreground"
        : isFocused
        ? "bg-accent text-accent-foreground"
        : "text-foreground",
    ].join(" "),
  noOptionsMessage: () => "text-muted-foreground text-sm text-center py-3",
  loadingMessage: () => "text-muted-foreground text-sm text-center py-3",
  multiValue: () => "bg-accent rounded px-1 text-sm flex items-center gap-1",
  multiValueLabel: () => "text-accent-foreground text-xs",
  multiValueRemove: () => "text-muted-foreground hover:text-destructive cursor-pointer",
};

// Needed only to fix menu portal z-index — no color styles here
export const rsPortalStyles = {
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
};

// Compact variant for use inside table cells
export const rsClassNamesCompact = {
  ...rsClassNames,
  control: ({ isFocused }: { isFocused: boolean }) =>
    [
      "flex min-h-8 w-full rounded border bg-background px-1 text-xs transition-colors cursor-default",
      isFocused
        ? "border-ring ring-2 ring-ring/20 outline-none"
        : "border-input hover:border-ring/50",
    ].join(" "),
  placeholder: () => "text-muted-foreground text-xs px-1",
  input: () => "text-foreground text-xs px-1",
  singleValue: () => "text-foreground text-xs px-1",
  dropdownIndicator: () => "text-muted-foreground hover:text-foreground px-1",
  option: ({ isFocused, isSelected }: { isFocused: boolean; isSelected: boolean }) =>
    [
      "px-2 py-1.5 cursor-pointer text-xs",
      isSelected
        ? "bg-primary text-primary-foreground"
        : isFocused
        ? "bg-accent text-accent-foreground"
        : "text-foreground",
    ].join(" "),
};
