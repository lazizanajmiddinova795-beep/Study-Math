import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/auth-card";
import { RegisterForm } from "@/features/auth/forms";

export const metadata: Metadata = { title: "Request a student account" };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Request a student account"
      subtitle="An administrator must approve your account before you can access learning content."
    >
      <RegisterForm />
    </AuthCard>
  );
}
