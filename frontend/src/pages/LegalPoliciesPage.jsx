import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, FileText, Cookie } from 'lucide-react';

export export const policies = {
  privacy: {
    title: 'Chính sách quyền riêng tư',
    updated: '26/10/2026',
    icon: ShieldCheck,
    intro: 'Chính sách này giải thích cách Kaito Todo thu thập, sử dụng, lưu giữ và bảo vệ thông tin khi bạn sử dụng ứng dụng.',
    sections: [
      ['1. Người vận hành và liên hệ', 'Ứng dụng Kaito Todo do cá nhân Nguyễn Văn Thái vận hành. Email liên hệ: kaitomuzicvn@gmail.com. Điện thoại: +84 793 903 870. Facebook: https://www.facebook.com/share/1KPgW9jyHm/.'],
      ['2. Dữ liệu được xử lý', 'Tùy theo tính năng bạn sử dụng, hệ thống có thể xử lý thông tin tài khoản như email, tên hiển thị, thông tin xác thực và thời điểm hoạt động; nội dung do bạn tạo như công việc, ghi chú, danh sách, lịch, hạn hoàn thành; dữ liệu phiên tập trung và thống kê tiến trình; tệp bạn tải lên cùng tên tệp, loại tệp, dung lượng và thông tin liên quan; thông báo và dữ liệu kỹ thuật cần thiết để duy trì phiên đăng nhập, tùy chọn giao diện và ngôn ngữ. Không nhập mật khẩu, mã xác minh hoặc thông tin bí mật vào nội dung ghi chú.'],
      ['3. Mục đích sử dụng', 'Dữ liệu được dùng để cung cấp các tính năng của ứng dụng, xác thực và bảo vệ tài khoản, đồng bộ nội dung với máy chủ khi tính năng đó được sử dụng, lưu tùy chọn, gửi thông báo hoặc email cần thiết, xử lý yêu cầu hỗ trợ, phát hiện lỗi và bảo vệ dịch vụ khỏi hành vi lạm dụng. Kaito Todo không tích hợp mô hình AI để phân tích nội dung người dùng trong sản phẩm hiện tại.'],
      ['4. Lưu trữ và bên xử lý dữ liệu', 'Dữ liệu có thể được lưu trên máy chủ cơ sở dữ liệu, hạ tầng lưu trữ tệp, dịch vụ lưu trữ ứng dụng và nhà cung cấp email được cấu hình cho dịch vụ. Các nhà cung cấp này có thể xử lý dữ liệu cần thiết để cung cấp hạ tầng. Vị trí lưu trữ cụ thể và danh sách nhà cung cấp đang hoạt động cần được xác nhận theo cấu hình triển khai thực tế trước khi công bố bản chính thức.'],
      ['5. Lưu giữ và xóa dữ liệu', 'Thời gian lưu giữ phụ thuộc loại dữ liệu, trạng thái tài khoản và yêu cầu vận hành hoặc pháp luật. Mã nguồn hiện có cơ chế dọn dẹp một số tài khoản không hoạt động sau khoảng 90 ngày kèm thông báo trước, và dọn một số nội dung trong Thùng rác sau khoảng 30 ngày. Không coi các mốc này là cam kết áp dụng cho mọi loại dữ liệu; người vận hành cần kiểm tra cấu hình triển khai thực tế. Bạn có thể liên hệ email hỗ trợ để yêu cầu truy cập, chỉnh sửa hoặc xóa dữ liệu, sau khi xác minh quyền sở hữu tài khoản.'],
      ['6. Bảo mật', 'Ứng dụng áp dụng các biện pháp kỹ thuật phù hợp với kiến trúc hiện tại, bao gồm xác thực tài khoản và bảo vệ mật khẩu bằng cơ chế băm ở phía máy chủ. Không có hệ thống nào bảo đảm an toàn tuyệt đối. Bạn nên dùng mật khẩu riêng, bảo vệ thiết bị và đăng xuất khi dùng thiết bị chung. Không gửi thông tin đăng nhập cho người khác.'],
      ['7. Quyền của người dùng và thay đổi chính sách', 'Bạn có thể yêu cầu thông tin về dữ liệu của mình, đề nghị cập nhật hoặc xóa dữ liệu và gửi khiếu nại qua kênh liên hệ nêu trên. Yêu cầu có thể cần xác minh danh tính và được xử lý theo quy định pháp luật áp dụng. Khi chính sách thay đổi đáng kể, phiên bản mới sẽ được công bố tại trang này; ứng dụng có thể yêu cầu bạn xác nhận lại trước khi tiếp tục sử dụng.']
    ]
  },
  terms: {
    title: 'Điều khoản sử dụng',
    updated: '26/10/2026',
    icon: FileText,
    intro: 'Khi tạo tài khoản hoặc tiếp tục sử dụng Kaito Todo sau khi xác nhận, bạn đồng ý tuân thủ các điều khoản dưới đây.',
    sections: [
      ['1. Người vận hành và liên hệ', 'Kaito Todo do cá nhân Nguyễn Văn Thái vận hành. Email: kaitomuzicvn@gmail.com. Điện thoại: +84 793 903 870. Facebook: https://www.facebook.com/share/1KPgW9jyHm/.'],
      ['2. Tài khoản', 'Bạn chịu trách nhiệm cung cấp thông tin phù hợp, giữ bí mật thông tin đăng nhập và các hoạt động phát sinh từ tài khoản của mình. Hãy thông báo cho người vận hành nếu nghi ngờ tài khoản bị truy cập trái phép. Không sử dụng dịch vụ để giả mạo người khác, xâm nhập hệ thống hoặc vi phạm pháp luật.'],
      ['3. Nội dung người dùng', 'Bạn giữ trách nhiệm đối với công việc, ghi chú, danh sách và tệp do mình tạo hoặc tải lên, bao gồm quyền hợp pháp đối với nội dung đó. Không tải lên nội dung trái pháp luật, xâm phạm quyền của người khác, chứa mã độc hoặc gây ảnh hưởng đến an toàn và hoạt động của dịch vụ.'],
      ['4. Tính sẵn sàng và dữ liệu', 'Dịch vụ có thể cần kết nối mạng để đăng nhập và truy cập dữ liệu trên máy chủ. Một số giao diện có thể mở khi ngoại tuyến nhưng điều đó không có nghĩa toàn bộ dữ liệu đã được đồng bộ hoặc có thể chỉnh sửa ngoại tuyến. Người dùng nên tự lưu giữ bản sao đối với dữ liệu quan trọng. Không cam kết khôi phục được dữ liệu đã bị xóa vĩnh viễn hoặc mất do sự cố ngoài khả năng kiểm soát hợp lý.'],
      ['5. Sử dụng hợp lý', 'Không làm gián đoạn dịch vụ, vượt qua biện pháp bảo vệ, khai thác lỗ hổng trái phép, gửi thư rác, tải tệp bị cấm hoặc sử dụng dịch vụ theo cách gây rủi ro cho người khác. Người vận hành có thể hạn chế hoạt động có dấu hiệu lạm dụng và sẽ xem xét tình huống phù hợp.'],
      ['6. Giới hạn và thay đổi dịch vụ', 'Các tính năng có thể thay đổi, tạm ngừng để bảo trì hoặc ngừng cung cấp. Điều khoản này không loại trừ trách nhiệm mà pháp luật không cho phép loại trừ và không làm mất các quyền bắt buộc của người tiêu dùng. Hiện tại, trang này không công bố gói Premium hay quy trình thanh toán; không thực hiện thanh toán dựa trên thông tin không được hiển thị rõ ràng trong ứng dụng.'],
      ['7. Luật áp dụng và cập nhật', 'Điều khoản được áp dụng phù hợp với pháp luật Việt Nam và các quy định bắt buộc liên quan. Khi có thay đổi quan trọng, bản cập nhật sẽ được đăng công khai và người dùng có thể được yêu cầu xác nhận lại. Nếu có tranh chấp, các bên ưu tiên liên hệ để xử lý trước khi thực hiện các quyền theo pháp luật.']
    ]
  },
  cookies: {
    title: 'Chính sách Cookie & lưu trữ trên thiết bị',
    updated: '26/10/2026',
    icon: Cookie,
    intro: 'Trang này mô tả cách Kaito Todo sử dụng bộ nhớ trình duyệt và công nghệ lưu trữ liên quan để duy trì hoạt động của ứng dụng.',
    sections: [
      ['1. Bộ nhớ trình duyệt', 'Mã nguồn hiện tại sử dụng localStorage và sessionStorage để lưu một số thông tin như token phiên đăng nhập, thông tin tài khoản đã lưu trên thiết bị, email tạm thời trong biểu mẫu xác thực, giao diện, ngôn ngữ và tùy chọn người dùng. Đây là bộ nhớ phía trình duyệt, không đồng nghĩa với cookie HTTP.'],
      ['2. Mục đích', 'Bộ nhớ này giúp duy trì trạng thái đăng nhập, khôi phục tùy chọn giao diện, ghi nhớ dữ liệu tạm trong luồng xác thực và giúp ứng dụng hoạt động thuận tiện hơn. Không tuyên bố rằng không có cookie nào được sử dụng ở mọi môi trường, vì cấu hình máy chủ, nhà cung cấp và trình duyệt triển khai có thể khác nhau.'],
      ['3. Service worker và bộ nhớ đệm', 'Ứng dụng web có service worker để lưu bộ khung ứng dụng và một số tài nguyên tĩnh nhằm hỗ trợ tải ứng dụng nhanh hơn. Theo tài liệu mã nguồn hiện tại, service worker không lưu cache các yêu cầu API hoặc dữ liệu người dùng. Việc dùng ứng dụng ngoại tuyến vẫn có giới hạn; không nên coi cache ứng dụng là bản sao lưu dữ liệu.'],
      ['4. Quản lý dữ liệu trên thiết bị', 'Bạn có thể xóa dữ liệu trang web trong cài đặt trình duyệt hoặc đăng xuất khỏi ứng dụng. Xóa bộ nhớ trình duyệt có thể khiến bạn bị đăng xuất hoặc mất các tùy chọn chỉ lưu trên thiết bị; thao tác đó không nhất thiết xóa dữ liệu đã lưu trên máy chủ. Không xóa dữ liệu ứng dụng nếu chưa hiểu ảnh hưởng đến dữ liệu cục bộ của mình.'],
      ['5. Công cụ phân tích và quảng cáo', 'Chính sách này không khẳng định rằng mọi bản triển khai đều không có công cụ phân tích, cookie hoặc dịch vụ bên thứ ba. Người vận hành cần kiểm tra bản triển khai thực tế trước khi công bố để bổ sung thông tin chính xác nếu có sử dụng các công cụ đó.']
    ]
  }
};

const LegalPoliciesPage = () => {
  const { policySlug } = useParams();
  const policy = policies[policySlug];
  const Icon = policy?.icon || FileText;

  if (!policy) {
    return (
      <main className='min-h-screen bg-slate-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-white'>
        <div className='mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900'>
          <h1 className='text-2xl font-bold'>Không tìm thấy chính sách</h1>
          <Link to='/signin' className='mt-4 inline-flex text-violet-600 underline dark:text-violet-400'>Quay lại đăng nhập</Link>
        </div>
      </main>
    );
  }

  return (
    <main className='min-h-screen bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),transparent_36%),linear-gradient(135deg,#f8fafc,#eef2ff)] px-4 py-8 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),transparent_36%),linear-gradient(135deg,#0f172a,#111827)] dark:text-slate-100 sm:px-6 sm:py-12'>
      <article className='mx-auto max-w-4xl rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900/95 sm:p-10'>
        <Link to='/signin' className='inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400'><ArrowLeft className='h-4 w-4' /> Quay lại đăng nhập</Link>
        <div className='mt-7 flex items-start gap-4'>
          <span className='flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'><Icon className='h-6 w-6' /></span>
          <div>
            <p className='text-xs font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300'>Kaito Todo · Chính sách công khai</p>
            <h1 className='mt-2 text-2xl font-bold tracking-tight sm:text-3xl'>{policy.title}</h1>
            <p className='mt-2 text-xs text-slate-500 dark:text-slate-400'>Cập nhật lần cuối: {policy.updated}</p>
          </div>
        </div>
        <p className='mt-7 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200'>{policy.intro}</p>
        <div className='mt-8 space-y-7'>
          {policy.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className='text-lg font-semibold'>{heading}</h2>
              <p className='mt-2 whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300'>{body}</p>
            </section>
          ))}
        </div>
        <div className='mt-10 border-t border-slate-200 pt-6 dark:border-slate-800'>
          <h2 className='text-sm font-semibold'>Các chính sách khác</h2>
          <div className='mt-3 flex flex-wrap gap-3 text-sm'>
            <Link to='/policies/privacy' className='text-violet-600 underline dark:text-violet-400'>Quyền riêng tư</Link>
            <Link to='/policies/terms' className='text-violet-600 underline dark:text-violet-400'>Điều khoản sử dụng</Link>
            <Link to='/policies/cookies' className='text-violet-600 underline dark:text-violet-400'>Cookie & lưu trữ</Link>
          </div>
          <p className='mt-6 text-xs leading-6 text-slate-500 dark:text-slate-400'>Đây là nội dung chính sách sản phẩm, không thay thế việc rà soát pháp lý theo cấu hình triển khai và quy định hiện hành.</p>
        </div>
      </article>
    </main>
  );
};

export default LegalPoliciesPage;
