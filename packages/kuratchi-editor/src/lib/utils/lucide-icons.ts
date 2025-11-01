import {
  Facebook,
  Instagram,
  Github,
  Linkedin,
  Youtube,
  X as XIcon,
  Home,
  Search,
  Menu,
  ArrowRight,
  Mail,
  Phone,
  Truck,
  BadgeDollarSign,
  CircleDollarSign,
  Star
} from '@lucide/svelte';

export const LucideIconMap = {
  facebook: Facebook,
  instagram: Instagram,
  x: XIcon,
  github: Github,
  linkedin: Linkedin,
  youtube: Youtube,
  home: Home,
  search: Search,
  menu: Menu,
  arrowRight: ArrowRight,
  mail: Mail,
  phone: Phone,
  truck: Truck,
  badgeDollarSign: BadgeDollarSign,
  circleDollarSign: CircleDollarSign,
  star: Star
} as const;

export type LucideIconKey = keyof typeof LucideIconMap;

export const lucideIconKeys: LucideIconKey[] = Object.keys(LucideIconMap) as LucideIconKey[];
