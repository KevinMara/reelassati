import {
  Children,
  Fragment,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

type Props = SelectHTMLAttributes<HTMLSelectElement>;
type Option = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  group?: string;
};
function optionsFrom(children: ReactNode, group?: string): Option[] {
  return Children.toArray(children).flatMap(child => {
    if (
      !isValidElement<{
        value?: string | number;
        children?: ReactNode;
        disabled?: boolean;
        label?: string;
      }>(child)
    )
      return [];
    if (child.type === Fragment)
      return optionsFrom(child.props.children, group);
    if (child.type === "optgroup")
      return optionsFrom(child.props.children, child.props.label);
    if (child.type !== "option") return [];
    return [
      {
        value: String(child.props.value ?? child.props.children ?? ""),
        label: child.props.children,
        disabled: child.props.disabled,
        group,
      },
    ];
  });
}

/** Uniform menus with native form/change semantics and Radix keyboard support. */
export function StudioSelect({
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  id,
  name,
  required,
  className,
  style,
  title,
  autoFocus,
  ...props
}: Props) {
  const native = useRef<HTMLSelectElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [invalid, setInvalid] = useState(false);
  const [internal, setInternal] = useState(String(defaultValue ?? ""));
  const options = optionsFrom(children);
  const selected = value === undefined ? internal : String(value);
  const empty = "__reelassati_empty_selection__";
  return (
    <>
      <select
        ref={native}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        name={name}
        required={required}
        onInvalid={event => {
          event.preventDefault();
          setInvalid(true);
          trigger.current?.focus();
          props.onInvalid?.(event);
        }}
        value={selected}
        disabled={disabled}
        onChange={onChange}
      >
        {children}
      </select>
      <Select
        value={selected || empty}
        disabled={disabled}
        required={required}
        onValueChange={next => {
          const raw = next === empty ? "" : next;
          setInternal(raw);
          setInvalid(false);
          if (native.current) {
            native.current.value = raw;
            native.current.dispatchEvent(
              new Event("change", { bubbles: true })
            );
          }
        }}
      >
        <SelectTrigger
          ref={trigger}
          id={id}
          title={title}
          autoFocus={autoFocus}
          style={style}
          aria-label={props["aria-label"]}
          aria-labelledby={props["aria-labelledby"]}
          aria-describedby={props["aria-describedby"]}
          aria-invalid={invalid || props["aria-invalid"]}
          aria-required={required}
          className={cn(
            "h-10 min-w-0 rounded-xl border-border bg-background px-3 text-sm font-medium shadow-none",
            className,
            "!py-0"
          )}
        >
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent position="popper" align="start" sideOffset={6}>
          {options.map((option, index) => (
            <Fragment key={`${option.value}-${index}`}>
              {option.group && option.group !== options[index - 1]?.group && (
                <div className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {option.group}
                </div>
              )}
              <SelectItem
                value={option.value || empty}
                disabled={option.disabled}
              >
                {option.label}
              </SelectItem>
            </Fragment>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
