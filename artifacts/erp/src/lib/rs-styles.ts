// Styles react-select compatibles shadcn/ui — partagés entre tous les modules
export const rsStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: "36px",
    borderRadius: "6px",
    borderColor: state.isFocused ? "hsl(var(--ring))" : "hsl(var(--input))",
    boxShadow: state.isFocused ? "0 0 0 2px hsl(var(--ring) / 0.2)" : "none",
    backgroundColor: "hsl(var(--background))",
    fontSize: "14px",
  }),
  menu: (base: any) => ({ ...base, zIndex: 50, borderRadius: "8px", fontSize: "14px" }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "hsl(var(--primary))"
      : state.isFocused
      ? "hsl(var(--muted))"
      : "transparent",
    color: state.isSelected ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
  }),
  singleValue: (base: any) => ({ ...base, color: "hsl(var(--foreground))" }),
  placeholder: (base: any) => ({ ...base, color: "hsl(var(--muted-foreground))" }),
  input: (base: any) => ({ ...base, color: "hsl(var(--foreground))" }),
};
