import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Ingresa un correo válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

export const forgotPasswordSchema = z.object({
  email: z.email("Ingresa un correo válido"),
});

const passwordPairShape = {
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirma la contraseña"),
};

export const resetPasswordSchema = z
  .object(passwordPairShape)
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, "Ingresa tu contraseña actual"),
    ...passwordPairShape,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "La nueva contraseña debe ser distinta a la actual",
    path: ["password"],
  });

export const inviteSignUpSchema = z
  .object({
    token: z.string().uuid(),
    email: z.email("Ingresa un correo válido"),
    ...passwordPairShape,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const resendConfirmationSchema = z.object({
  email: z.email("Ingresa un correo válido"),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type InviteSignUpValues = z.infer<typeof inviteSignUpSchema>;
