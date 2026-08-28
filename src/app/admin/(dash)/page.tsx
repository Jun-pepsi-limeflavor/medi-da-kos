import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">백오피스</h1>
      <ul className="space-y-2 text-sm">
        <li><Link href="/admin/inbox" className="text-indigo-400 hover:underline font-medium">통합 받은편지함</Link></li>
        <li><Link href="/admin/deals" className="text-indigo-400 hover:underline font-medium">딜 보드 (파이프라인 원장)</Link></li>
        <li><Link href="/admin/buyers" className="text-indigo-400 hover:underline">바이어 원장</Link></li>
        <li><Link href="/admin/suppliers" className="text-indigo-400 hover:underline">제조사 원장</Link></li>
        <li><Link href="/admin/intakes" className="text-indigo-400 hover:underline">인테이크 원장</Link></li>
      </ul>
    </div>
  );
}
