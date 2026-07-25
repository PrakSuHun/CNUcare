// 폼 전용 배포(genforms)의 중립 홈. CNUcare 브랜딩/노출 없음.
export default function FormsHome() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-2xl">
          📝
        </div>
        <h1 className="text-lg font-semibold text-gray-800">온라인 신청 · 출석 폼</h1>
        <p className="mt-2 text-sm text-gray-500">
          이 서비스는 전달받은 개별 링크를 통해서만 이용할 수 있습니다.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          받으신 신청/출석 링크로 접속해 주세요.
        </p>
      </div>
    </div>
  );
}
