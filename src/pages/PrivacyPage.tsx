import { useSiteSettings } from '../context/SiteSettingsContext'
import './LegalPage.css'

export default function PrivacyPage() {
  const { settings } = useSiteSettings()
  const companyName = settings?.companyName ?? 'Farmday'
  const ceoName = settings?.ceoName ?? ''
  const phone = settings?.phone ?? ''

  return (
    <div className="container legal-page">
      <h1>개인정보처리방침</h1>
      <p className="legal-updated">시행일: 2026년 8월 1일</p>

      <div className="legal-section">
        <p>
          {companyName}(이하 "회사")는 이용자의 개인정보를 중요시하며, "개인정보보호법" 등 관련 법령을 준수하고
          있습니다. 회사는 개인정보처리방침을 통하여 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고
          있으며, 개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
        </p>
      </div>

      <div className="legal-section">
        <h2>1. 수집하는 개인정보 항목</h2>
        <p>회사는 회원가입, 상담, 주문 등을 위해 아래와 같은 개인정보를 수집합니다.</p>
        <ul>
          <li>회원가입 시: 이메일, 비밀번호, 이름(선택), 연락처(선택), 주소(선택)</li>
          <li>주문/결제 시: 주문자명, 배송지 주소, 연락처, 결제정보(결제대행사에서 처리)</li>
          <li>서비스 이용 과정에서 자동 수집: 접속 로그, 쿠키, 서비스 이용 기록</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>2. 개인정보의 수집 및 이용목적</h2>
        <ul>
          <li>회원 관리: 회원제 서비스 이용에 따른 본인확인, 개인 식별</li>
          <li>재화 또는 서비스 제공: 상품 배송, 주문 및 결제, 청구서 발송</li>
          <li>마케팅 및 광고 활용: 이벤트 및 광고성 정보 제공 (동의한 경우에 한함)</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>3. 개인정보의 보유 및 이용기간</h2>
        <p>
          회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계
          법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 아래와 같이 관계 법령에서 정한 일정한 기간 동안
          회원정보를 보관합니다.
        </p>
        <table className="legal-table">
          <thead>
            <tr>
              <th>보관 항목</th>
              <th>보관 기간</th>
              <th>근거 법령</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>계약 또는 청약철회 등에 관한 기록</td>
              <td>5년</td>
              <td>전자상거래 등에서의 소비자보호에 관한 법률</td>
            </tr>
            <tr>
              <td>대금결제 및 재화 등의 공급에 관한 기록</td>
              <td>5년</td>
              <td>전자상거래 등에서의 소비자보호에 관한 법률</td>
            </tr>
            <tr>
              <td>소비자의 불만 또는 분쟁처리에 관한 기록</td>
              <td>3년</td>
              <td>전자상거래 등에서의 소비자보호에 관한 법률</td>
            </tr>
            <tr>
              <td>웹사이트 방문기록</td>
              <td>3개월</td>
              <td>통신비밀보호법</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="legal-section">
        <h2>4. 개인정보의 제3자 제공</h2>
        <p>
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 상품 배송을 위해 배송업체에 최소한의
          정보(수령인, 주소, 연락처)를 제공하며, 결제 처리를 위해 결제대행사(토스페이먼츠 등)에 결제에 필요한 정보를
          제공할 수 있습니다.
        </p>
      </div>

      <div className="legal-section">
        <h2>5. 개인정보처리 위탁</h2>
        <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있습니다.</p>
        <ul>
          <li>결제 처리: 토스페이먼츠 (결제 정보 처리)</li>
          <li>데이터 보관 및 인증: Supabase (회원정보, 주문정보 등 저장 및 관리)</li>
        </ul>
      </div>

      <div className="legal-section">
        <h2>6. 이용자의 권리와 행사방법</h2>
        <p>
          이용자는 언제든지 등록되어 있는 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원탈퇴를 요청할 수도
          있습니다. 개인정보 조회, 수정, 삭제를 원하실 경우 마이페이지 또는 고객센터를 통해 요청해 주시기 바랍니다.
        </p>
      </div>

      <div className="legal-section">
        <h2>7. 개인정보의 파기</h2>
        <p>
          회사는 원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 전자적 파일
          형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.
        </p>
      </div>

      <div className="legal-section">
        <h2>8. 개인정보 보호책임자</h2>
        <p>
          회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만처리 및 피해구제
          등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
        </p>
        <ul>
          <li>성명: {ceoName || '(사이트 설정에서 대표자명을 입력해주세요)'}</li>
          <li>연락처: {phone || '(사이트 설정에서 전화번호를 입력해주세요)'}</li>
        </ul>
      </div>
    </div>
  )
}
