import {
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Plane,
  ShoppingBag,
  Smartphone,
  Tag,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export const CATEGORY_ICONS: Array<{ name: string; component: LucideIcon }> = [
  { name: 'Briefcase', component: Briefcase },
  { name: 'Laptop', component: Laptop },
  { name: 'TrendingUp', component: TrendingUp },
  { name: 'Utensils', component: Utensils },
  { name: 'Coffee', component: Coffee },
  { name: 'Home', component: Home },
  { name: 'Car', component: Car },
  { name: 'Plane', component: Plane },
  { name: 'ShoppingBag', component: ShoppingBag },
  { name: 'Zap', component: Zap },
  { name: 'HeartPulse', component: HeartPulse },
  { name: 'GraduationCap', component: GraduationCap },
  { name: 'Smartphone', component: Smartphone },
  { name: 'CreditCard', component: CreditCard },
  { name: 'Gift', component: Gift },
  { name: 'Tag', component: Tag },
];

export function CategoryIcon({
  name,
  className = 'w-4 h-4',
}: {
  name?: string;
  className?: string;
}) {
  const match = CATEGORY_ICONS.find((item) => item.name === name);
  const Icon = match ? match.component : Tag;
  return <Icon className={className} aria-hidden="true" />;
}
