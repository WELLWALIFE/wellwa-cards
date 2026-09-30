import {
  Phone,
  Mail,
  MessageCircle,
  Globe,
  Camera,
  AtSign,
  Briefcase,
  Video,
  MapPin,
  IndianRupee,
  Link2,
} from "lucide-react";
import type { LinkType } from "@/lib/types";

// Note: lucide-react removed brand icons (Instagram/Facebook/…),
// so we map social links to neutral, always-available glyphs.
const map = {
  phone: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  website: Globe,
  instagram: Camera,
  facebook: AtSign,
  linkedin: Briefcase,
  youtube: Video,
  location: MapPin,
  upi: IndianRupee,
} as const;

export function LinkIcon({ type, className }: { type: LinkType; className?: string }) {
  const Icon = map[type] ?? Link2;
  return <Icon className={className} strokeWidth={2} />;
}

/** Build the href for a card link based on its type. */
export function linkHref(type: LinkType, value: string): string {
  switch (type) {
    case "phone":
      return `tel:${value}`;
    case "email":
      return `mailto:${value}`;
    case "whatsapp":
      return `https://wa.me/${value.replace(/[^0-9]/g, "")}`;
    case "upi":
      // Encoded so a stray "&" or space cannot break the link; "@" is legal in a
      // query and stays literal, because a few UPI apps do not decode "%40".
      return `upi://pay?pa=${encodeURIComponent(value.trim()).replace(/%40/g, "@")}&cu=INR`;
    case "location":
      // A pasted Google Maps link (maps.app.goo.gl/…, an exact pin) opens as-is;
      // wrapping it in ?q=<url> would search for the URL text and land elsewhere.
      return /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://maps.google.com/?q=${encodeURIComponent(value)}`;
    default:
      return value;
  }
}
