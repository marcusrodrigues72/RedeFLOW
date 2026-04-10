import { Avatar, Tooltip } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

interface UserAvatarProps {
  nome: string;
  fotoUrl?: string | null;
  size?: number;
  showTooltip?: boolean;
  sx?: SxProps<Theme>;
}

function getInitials(nome: string): string {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function UserAvatar({ nome, fotoUrl, size = 32, showTooltip = false, sx }: UserAvatarProps) {
  const avatar = (
    <Avatar
      src={fotoUrl ?? undefined}
      sx={{
        width: size,
        height: size,
        bgcolor: "primary.light",
        fontWeight: 700,
        fontSize: size * 0.3125,
        flexShrink: 0,
        ...sx,
      }}
    >
      {getInitials(nome)}
    </Avatar>
  );

  if (showTooltip) {
    return <Tooltip title={nome}>{avatar}</Tooltip>;
  }
  return avatar;
}
