import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function make(paths: React.ReactNode) {
  return function Icon({ size = 20, ...p }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
        {paths}
      </svg>
    );
  };
}

export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>);
export const CarIcon = make(<><path d="M5 17h14v-5l-2-5H7l-2 5z" /><path d="M5 12h14" /><circle cx="8" cy="17" r="1.6" /><circle cx="16" cy="17" r="1.6" /></>);
export const ListIcon = make(<><path d="M8 6h12M8 12h12M8 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>);
export const UserIcon = make(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const UsersIcon = make(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>);
export const LayersIcon = make(<><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>);
export const PlusIcon = make(<path d="M12 5v14M5 12h14" />);
export const UploadIcon = make(<><path d="M12 15V4M7 9l5-5 5 5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>);
export const CameraIcon = make(<><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>);
export const FileIcon = make(<><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /></>);
export const ImageIcon = make(<><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>);
export const DownloadIcon = make(<><path d="M12 4v11M7 10l5 5 5-5" /><path d="M4 20h16" /></>);
export const TrashIcon = make(<><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>);
export const EditIcon = make(<><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13 7 4 4" /></>);
export const ArchiveIcon = make(<><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v11h14V9M10 13h4" /></>);
export const ChevronRight = make(<path d="m9 6 6 6-6 6" />);
export const ChevronLeft = make(<path d="m15 6-6 6 6 6" />);
export const XIcon = make(<path d="M6 6l12 12M18 6 6 18" />);
export const ClockIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const AlertIcon = make(<><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>);
export const CheckIcon = make(<path d="m5 12 5 5 9-10" />);
export const EyeIcon = make(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
export const PhoneIcon = make(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />);
export const LogoutIcon = make(<><path d="M15 4h4v16h-4" /><path d="M10 16l-4-4 4-4M6 12h11" /></>);
export const PhoneDeviceIcon = make(<><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>);
export const ShieldIcon = make(<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z" />);
export const RefreshIcon = make(<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>);
export const HomeIcon = make(<><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /></>);
export const ExternalIcon = make(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>);
export const WifiOffIcon = make(<><path d="M2 8.5a15 15 0 0 1 5-3M22 8.5a15 15 0 0 0-11-4M5 12.5a10 10 0 0 1 4-2.4M19 12.5a10 10 0 0 0-3-2M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" /></>);
