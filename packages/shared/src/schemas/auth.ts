import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ required_error: "E-mail obrigatório" })
    .email("E-mail inválido")
    .toLowerCase(),
  senha: z
    .string({ required_error: "Senha obrigatória" })
    .min(8, "Senha deve ter no mínimo 8 caracteres"),
});

export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: "Token de atualização obrigatório" }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
