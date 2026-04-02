"use client";
import { useParams } from "next/navigation";
import LifeDetail from "@/components/LifeDetail";

export default function ManagerLifeDetailPage() {
  const params = useParams();
  return <LifeDetail lifeId={params.id as string} basePath="/manager" backPath="/manager" />;
}
