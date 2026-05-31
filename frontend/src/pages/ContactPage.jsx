import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Clock,
  HelpCircle,
  Mail,
  MapPin,
  Phone,
  Ruler,
  Send,
  Shirt,
  Truck,
} from "lucide-react";
import { apiRequest } from "../lib/api.js";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  orderCode: "",
  topic: "",
  message: "",
};

const topics = [
  "Tư vấn sản phẩm",
  "Tra cứu đơn hàng",
  "Đổi trả / hoàn tiền",
  "Giao hàng",
  "Khiếu nại dịch vụ",
];

const directContacts = [
  {
    icon: Mail,
    title: "Email",
    items: [
      { label: "Hỗ trợ chung", value: "support@fashionstore.vn", href: "mailto:support@fashionstore.vn" },
    ],
  },
  {
    icon: Phone,
    title: "Hotline",
    items: [
      { label: "Bán hàng / Khiếu nại", value: "0901 234 567", href: "tel:+84901234567" },
    ],
  },
  {
    icon: MapPin,
    title: "Cửa hàng",
    items: [
      { label: "Địa chỉ", value: "123 Nguyễn Trãi, Quận 1, TP. Hồ Chí Minh", href: "https://www.google.com/maps/search/?api=1&query=123%20Nguyen%20Trai%20Quan%201%20TP%20Ho%20Chi%20Minh" },
    ],
  },
  {
    icon: Clock,
    title: "Giờ làm việc",
    items: [
      { label: "Thứ 2 - Chủ nhật", value: "08:00 - 22:00" },
    ],
  },
];

const quickHelps = [
  { icon: Truck, title: "Chính sách giao hàng", copy: "Theo dõi phí vận chuyển và thời gian nhận hàng.", href: "/products" },
  { icon: Ruler, title: "Bảng size", copy: "Chọn đúng form trước khi đặt mua.", href: "/products" },
  { icon: Shirt, title: "Đổi trả sản phẩm", copy: "Quy trình đổi size, đổi màu và hoàn tiền.", href: "/profile?tab=orders" },
  { icon: HelpCircle, title: "Tra cứu đơn hàng", copy: "Kiểm tra nhanh trạng thái xử lý.", href: "/orders" },
];

function InstagramLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function TikTokLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.7 3c.28 2.38 1.62 3.8 3.95 3.95v3.08a7.5 7.5 0 0 1-3.88-.95v5.79c0 7.36-8.02 9.65-11.25 4.38-2.08-3.39-.8-9.35 5.87-9.59v3.25c-.49.08-1.02.21-1.5.38-1.45.49-2.27 1.41-2.04 3.04.44 3.12 6.16 4.05 5.68-2.06V3h3.17Z" />
    </svg>
  );
}

function FacebookLogo({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.25 10.44 22v-7.03H7.9v-2.91h2.54V9.84c0-2.52 1.5-3.91 3.77-3.91 1.1 0 2.24.2 2.24.2V8.6h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22C18.34 21.25 22 17.08 22 12.06Z" />
    </svg>
  );
}

const socialLinks = [
  { label: "Instagram", icon: InstagramLogo, href: "https://instagram.com" },
  { label: "TikTok", icon: TikTokLogo, href: "https://tiktok.com" },
  { label: "Facebook", icon: FacebookLogo, href: "https://facebook.com" },
];

function validate(values) {
  const nextErrors = {};
  const phone = values.phone.trim().replace(/\s/g, "");

  if (values.fullName.trim().length < 2) {
    nextErrors.fullName = "Vui lòng nhập họ tên đầy đủ.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    nextErrors.email = "Email chưa đúng định dạng.";
  }

  if (!/^(\+84|0)[0-9]{8,10}$/.test(phone)) {
    nextErrors.phone = "Số điện thoại chưa hợp lệ.";
  }

  if (values.orderCode.trim() && values.orderCode.trim().length < 5) {
    nextErrors.orderCode = "Mã đơn hàng cần có ít nhất 5 ký tự.";
  }

  if (!values.topic) {
    nextErrors.topic = "Vui lòng chọn chủ đề cần hỗ trợ.";
  }

  if (values.message.trim().length < 20) {
    nextErrors.message = "Nội dung cần ít nhất 20 ký tự để FashionStore hỗ trợ chính xác hơn.";
  }

  return nextErrors;
}

export default function ContactPage() {
  const { user, token, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketCode, setTicketCode] = useState("");

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: user.fullname || user.username || prev.fullName,
        email: user.email || prev.email,
        phone: user.phone || prev.phone,
      }));
    }
  }, [user]);

  const errors = useMemo(() => validate(form), [form]);

  const updateField = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  const shouldShowError = (name) => (submitted || touched[name]) && errors[name];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitted(true);

    if (Object.keys(errors).length > 0) {
      toast.error("Vui lòng kiểm tra lại thông tin liên hệ.");
      return;
    }

    setLoading(true);

    try {
      const response = await apiRequest("/contact", {
        method: "POST",
        token,
        body: form,
      });
      const code = response.data?.ticketCode || "";
      setTicketCode(code);
      setForm(initialForm);
      setTouched({});
      setSubmitted(false);
      toast.success(code ? `Yêu cầu ${code} đã được ghi nhận.` : "Yêu cầu đã được ghi nhận.");
    } catch (error) {
      toast.error(error.message || "Chưa thể gửi yêu cầu. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="bg-[#FAF8F5] text-[#171717]">
      <section className="relative min-h-[520px] overflow-hidden bg-black text-white md:min-h-[640px]">
        <img
          src="/images/bst.jpg"
          alt="FashionStore lookbook"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
        <div className="relative z-10 mx-auto flex min-h-[520px] max-w-[1440px] flex-col justify-end px-4 pb-14 pt-24 md:min-h-[640px] md:px-8 md:pb-20">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.28em] text-[#D9B98C]">
            FashionStore Concierge
          </p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Chăm sóc từng trải nghiệm mua sắm của bạn
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-white/80 md:text-base">
            Từ tư vấn phong cách, tra cứu đơn hàng đến hỗ trợ đổi trả, đội ngũ FashionStore luôn phản hồi với sự chỉn chu và tận tâm.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="tel:+84901234567"
              className="inline-flex min-h-12 items-center justify-center gap-2 bg-white px-7 text-sm font-bold uppercase tracking-[0.14em] text-black transition hover:bg-[#D9B98C]"
            >
              <Phone className="h-4 w-4" />
              Gọi ngay
            </a>
            <a
              href="#contact-form"
              className="inline-flex min-h-12 items-center justify-center gap-2 border border-white/80 px-7 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-white hover:text-black"
            >
              Gửi yêu cầu
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-px bg-[#E4DED6] px-4 py-10 md:grid-cols-2 md:px-8 lg:grid-cols-4">
        {directContacts.map((contact) => {
          const Icon = contact.icon;
          return (
            <article key={contact.title} className="bg-white p-5 md:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center bg-[#171717] text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold">{contact.title}</h2>
              </div>
              <div className="space-y-4">
                {contact.items.map((item) => (
                  <div key={`${contact.title}-${item.label}`}>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8A7A68]">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a href={item.href} className="mt-1 block text-sm leading-6 text-[#171717] hover:text-[#A66F2B]">
                        {item.value}
                      </a>
                    ) : (
                      <p className="mt-1 text-sm leading-6 text-[#171717]">{item.value}</p>
                    )}
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mx-auto grid max-w-[1440px] gap-8 px-4 pb-12 md:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div id="contact-form" className="border border-[#E4DED6] bg-white p-5 md:p-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#C58B45]">
            Gửi yêu cầu hỗ trợ
          </p>
          <h2 className="text-2xl font-bold leading-tight md:text-4xl">
            FashionStore sẽ tiếp nhận và phản hồi trong thời gian sớm nhất
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#6B625A]">
            Với vấn đề liên quan đến đơn hàng, mã đơn hàng giúp đội ngũ chăm sóc khách hàng kiểm tra nhanh hơn.
          </p>

          {!isAuthenticated ? (
            <div className="mt-8 border border-[#E4DED6] bg-[#FAF8F5] p-6 text-center">
              <p className="mb-4 text-sm font-medium text-[#171717]">
                Vui lòng đăng nhập để gửi yêu cầu hỗ trợ. Điều này giúp FashionStore ngăn chặn spam và quản lý yêu cầu của bạn tốt hơn.
              </p>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex min-h-12 items-center justify-center bg-[#171717] px-8 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#C58B45]"
              >
                Đăng nhập ngay
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {ticketCode ? (
                <div className="mt-6 border border-[#CFE1D7] bg-[#F1F8F4] px-4 py-3 text-sm text-[#2F6B4F]">
                  Yêu cầu {ticketCode} đã được ghi nhận. FashionStore sẽ phản hồi qua email hoặc điện thoại bạn cung cấp.
                </div>
              ) : null}

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <Field label="Họ tên" error={shouldShowError("fullName")}>
                  <input
                    value={form.fullName}
                    onBlur={() => setTouched((current) => ({ ...current, fullName: true }))}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    className="contact-input"
                    placeholder="Nguyễn Minh Anh"
                  />
                </Field>

                <Field label="Email" error={shouldShowError("email")}>
                  <input
                    type="email"
                    value={form.email}
                    onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="contact-input"
                    placeholder="email@example.com"
                  />
                </Field>

                <Field label="Số điện thoại" error={shouldShowError("phone")}>
                  <input
                    value={form.phone}
                    onBlur={() => setTouched((current) => ({ ...current, phone: true }))}
                    onChange={(event) => updateField("phone", event.target.value)}
                    className="contact-input"
                    placeholder="0901 234 567"
                  />
                </Field>

                <Field label="Mã đơn hàng" optional error={shouldShowError("orderCode")}>
                  <input
                    value={form.orderCode}
                    onBlur={() => setTouched((current) => ({ ...current, orderCode: true }))}
                    onChange={(event) => updateField("orderCode", event.target.value.toUpperCase())}
                    className="contact-input"
                    placeholder="FS123456"
                  />
                </Field>

                <Field label="Chủ đề cần hỗ trợ" error={shouldShowError("topic")}>
                  <select
                    value={form.topic}
                    onBlur={() => setTouched((current) => ({ ...current, topic: true }))}
                    onChange={(event) => updateField("topic", event.target.value)}
                    className="contact-input"
                  >
                    <option value="">Chọn chủ đề</option>
                    {topics.map((topic) => (
                      <option key={topic} value={topic}>
                        {topic}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="hidden md:block" />

                <div className="md:col-span-2">
                  <Field label="Nội dung" error={shouldShowError("message")}>
                    <textarea
                      value={form.message}
                      onBlur={() => setTouched((current) => ({ ...current, message: true }))}
                      onChange={(event) => updateField("message", event.target.value)}
                      className="contact-input min-h-[150px] resize-none"
                      placeholder="Hãy mô tả vấn đề bạn cần FashionStore hỗ trợ..."
                    />
                  </Field>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-[#171717] px-7 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#C58B45] disabled:cursor-not-allowed disabled:bg-[#6B625A] md:w-auto"
              >
                {loading ? "Đang gửi..." : "Gửi yêu cầu"}
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>

        <div className="grid gap-6">
          <div className="min-h-[360px] overflow-hidden border border-[#E4DED6] bg-white">
            <iframe
              title="FashionStore location"
              src="https://www.google.com/maps?q=123%20Nguyen%20Trai%2C%20Quan%201%2C%20Ho%20Chi%20Minh%20City&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-full min-h-[360px] w-full border-0"
            />
          </div>
          <div className="border border-[#E4DED6] bg-[#171717] p-6 text-white">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#D9B98C]">
              Concierge note
            </p>
            <p className="mt-3 text-2xl font-bold leading-tight">
              Nếu trải nghiệm của bạn chưa trọn vẹn, FashionStore sẽ kiểm tra kỹ từng chi tiết.
            </p>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Vui lòng để lại mã đơn hàng nếu có. Đội ngũ hỗ trợ sẽ ưu tiên các yêu cầu đổi trả, giao hàng và khiếu nại dịch vụ.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 pb-12 md:px-8">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#C58B45]">
              Hỗ trợ nhanh
            </p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">Những câu hỏi được quan tâm nhiều nhất</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#6B625A]">
            Các lối tắt này giúp bạn tự kiểm tra nhanh trước khi gửi yêu cầu đến bộ phận chăm sóc khách hàng.
          </p>
        </div>
        <div className="grid gap-px bg-[#E4DED6] md:grid-cols-2 lg:grid-cols-4">
          {quickHelps.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.title} to={item.href} className="group bg-white p-5 transition hover:bg-[#171717] hover:text-white">
                <Icon className="mb-5 h-6 w-6 text-[#C58B45]" />
                <h3 className="text-base font-bold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#6B625A] group-hover:text-white/70">{item.copy}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 pb-16 md:px-8">
        <div className="flex flex-col gap-5 border-y border-[#E4DED6] py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#C58B45]">
              Social atelier
            </p>
            <h2 className="mt-2 text-2xl font-bold">Theo dõi FashionStore qua những kênh hình ảnh</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
            {socialLinks.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#E4DED6] bg-white px-4 text-sm font-semibold text-[#171717] transition hover:border-[#171717]"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <div className="fixed inset-x-4 bottom-4 z-40 grid grid-cols-2 gap-3 md:hidden">
        <a href="tel:+84901234567" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#171717] text-sm font-bold uppercase tracking-[0.12em] text-white shadow-lg">
          <Phone className="h-4 w-4" />
          Gọi
        </a>
        <a href="#contact-form" className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#C58B45] text-sm font-bold uppercase tracking-[0.12em] text-white shadow-lg">
          <Mail className="h-4 w-4" />
          Form
        </a>
      </div>
    </main>
  );
}

function Field({ label, optional, error, children }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-semibold text-[#171717]">
        {label}
        {optional ? <span className="text-xs font-normal text-[#6B625A]">Tùy chọn</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-sm text-[#B42318]">{error}</span> : null}
    </label>
  );
}
