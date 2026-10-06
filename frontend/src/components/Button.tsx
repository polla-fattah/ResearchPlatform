import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import styles from './Button.module.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'secondary' | 'primary' | 'danger' | 'ghost'
}

export function Button({ variant = 'secondary', className, type = 'button', ...rest }: Props) {
  const cls = [styles.button, variant !== 'secondary' ? styles[variant] : '', className]
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={cls} {...rest} />
}

/** A link that looks like a button (never a <button> inside an <a>). */
export function ButtonLink({
  variant = 'secondary',
  className,
  ...rest
}: LinkProps & { variant?: Props['variant'] }) {
  const cls = [styles.button, variant !== 'secondary' ? styles[variant] : '', className]
    .filter(Boolean)
    .join(' ')
  return <Link className={cls} {...rest} />
}
