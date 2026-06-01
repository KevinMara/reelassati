import type { InputHTMLAttributes } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
};

export default function Field({ label, name, className = "", ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="block text-xs font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        id={name}
        name={name}
        className={[
          "mt-3 w-full rounded-xl bg-black px-4 py-3 text-base text-foreground outline-none",
          "border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/30",
          className,
        ].join(" ")}
        {...props}
      />
    </label>
  );
}
