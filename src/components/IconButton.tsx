import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function IconButton({ children, className = "icon-button", type = "button", ...props }: IconButtonProps) {
  return (
    <button className={className} type={type} {...props}>
      {children}
    </button>
  );
}
