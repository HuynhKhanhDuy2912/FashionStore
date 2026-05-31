import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MessageSquareReply,
  Phone,
  Search,
  Send,
  User,
} from "lucide-react";
import AdminPageHeader from "../../components/AdminPageHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { apiRequest } from "../../lib/api.js";

const statusOptions = [
  { value: "all", label: "Tất cả" },
  { value: "new", label: "Mới" },
  { value: "resolved", label: "Đã xử lý" },
];

const statusMeta = {
  new: {
    label: "Mới",
    className: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Inbox,
  },
  resolved: {
    label: "Đã xử lý",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
};

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] || statusMeta.new;
  const Icon = meta.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function buildDefaultReplySubject(message) {
  if (!message) return "";
  return `FashionStore phản hồi yêu cầu ${message.ticketCode}`;
}

export default function AdminContactMessagesPage() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [replyForm, setReplyForm] = useState({
    subject: "",
    message: "",
  });
  const [replying, setReplying] = useState(false);

  const loadMessages = async () => {
    try {
      setLoadingList(true);
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search.trim()) params.set("search", search.trim());

      const response = await apiRequest(`/contact?${params.toString()}`, { token });
      setMessages(response.data || []);
    } catch (error) {
      toast.error(error.message || "Không thể tải danh sách tin nhắn.");
    } finally {
      setLoadingList(false);
    }
  };

  const loadMessageDetail = async (id) => {
    if (!id) {
      setSelectedMessage(null);
      return;
    }

    try {
      setLoadingDetail(true);
      const response = await apiRequest(`/contact/${id}`, { token });
      const message = response.data;
      setSelectedMessage(message);

      if (message && !message.isRead) {
        await apiRequest(`/contact/${id}/read`, {
          method: "PATCH",
          token,
        });
        setSelectedMessage((current) =>
          current ? { ...current, isRead: true, readAt: new Date().toISOString() } : current,
        );
        loadMessages();
      }
    } catch (error) {
      toast.error(error.message || "Không thể tải tin nhắn.");
      setSelectedMessage(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [token, statusFilter]);

  useEffect(() => {
    loadMessageDetail(requestId);
  }, [requestId, token]);

  useEffect(() => {
    setReplyForm({
      subject: buildDefaultReplySubject(selectedMessage),
      message: "",
    });
  }, [selectedMessage?._id]);

  const stats = useMemo(() => {
    const total = messages.length;
    const unread = messages.filter((item) => !item.isRead).length;
    const unresolved = messages.filter((item) => item.status !== "resolved").length;

    return { total, unread, unresolved };
  }, [messages]);

  const handleSearch = (event) => {
    event.preventDefault();
    loadMessages();
  };

  const updateStatus = async (nextStatus) => {
    if (!selectedMessage) return;

    try {
      const response = await apiRequest(`/contact/${selectedMessage._id}/status`, {
        method: "PATCH",
        token,
        body: { status: nextStatus },
      });
      setSelectedMessage(response.data);
      toast.success("Đã cập nhật trạng thái tin nhắn.");
      loadMessages();
    } catch (error) {
      toast.error(error.message || "Không thể cập nhật trạng thái.");
    }
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!selectedMessage || replyForm.subject.trim().length < 5) {
      toast.error("Tiêu đề email cần ít nhất 5 ký tự.");
      return;
    }

    if (replyForm.message.trim().length < 10) {
      toast.error("Nội dung phản hồi cần ít nhất 10 ký tự.");
      return;
    }

    try {
      setReplying(true);
      const response = await apiRequest(`/contact/${selectedMessage._id}/reply`, {
        method: "POST",
        token,
        body: {
          subject: replyForm.subject.trim(),
          message: replyForm.message.trim(),
        },
      });
      setSelectedMessage(response.data?.contactRequest || null);
      setReplyForm((current) => ({ ...current, message: "" }));
      toast.success(response.message || "Đã lưu phản hồi.");
      loadMessages();
    } catch (error) {
      toast.error(error.message || "Không thể gửi phản hồi.");
    } finally {
      setReplying(false);
    }
  };

  return (
    <section className="grid gap-4 p-6">
      <AdminPageHeader
        title="QUẢN LÝ TIN NHẮN LIÊN HỆ"
        description={`${stats.total} tin nhắn, ${stats.unread} chưa đọc, ${stats.unresolved} chưa hoàn tất`}
      />

      <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 p-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex flex-1 items-center rounded-lg border border-gray-200 bg-white px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm tên, email, mã yêu cầu..."
                  className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                />
              </div>
              <button className="rounded-lg bg-black px-4 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800">
                Tìm
              </button>
            </form>

            <div className="mt-3 flex gap-2 overflow-x-auto">
              {statusOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setStatusFilter(item.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${statusFilter === item.value
                    ? "border-black bg-black text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-black hover:text-black"
                    }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {loadingList ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">Đang tải hộp thư...</div>
            ) : messages.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-gray-500">Chưa có tin nhắn liên hệ</div>
            ) : (
              messages.map((item) => (
                <button
                  key={item._id}
                  type="button"
                  onClick={() => navigate(`/admin/contact-messages/${item._id}`)}
                  className={`flex w-full gap-3 border-b border-gray-100 px-4 py-4 text-left transition hover:bg-gray-50 ${item._id === requestId ? "bg-gray-50" : item.isRead ? "bg-white" : "bg-blue-50/50"
                    }`}
                >
                  <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-bold text-black">{item.fullName}</span>
                      {!item.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" /> : null}
                    </span>
                    <span className="block truncate text-xs font-medium text-gray-700">
                      {item.ticketCode} - {item.topic}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{item.message}</span>
                    <span className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge status={item.status} />
                      <span className="text-[11px] text-gray-400">{formatDateTime(item.createdAt)}</span>
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="min-h-[620px] rounded-xl border border-gray-200 bg-white shadow-sm">
          {!requestId ? (
            <div className="grid h-full min-h-[620px] place-items-center px-6 text-center">
              <div>
                <Inbox className="mx-auto h-12 w-12 text-gray-300" />
                <h2 className="mt-4 text-md font-bold text-black">Chọn một tin nhắn để xem chi tiết</h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
                  Tin mới từ trang liên hệ sẽ xuất hiện ở đây để bạn theo dõi và xử lý.
                </p>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="grid min-h-[620px] place-items-center text-sm text-gray-500">Đang tải chi tiết...</div>
          ) : !selectedMessage ? (
            <div className="grid min-h-[620px] place-items-center px-6 text-center">
              <div>
                <h2 className="text-lg font-bold text-black">Không tìm thấy tin nhắn</h2>
                <Link to="/admin/contact-messages" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600">
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại hộp thư
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 p-6">
              <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedMessage.status} />
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                      {selectedMessage.ticketCode}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-black">{selectedMessage.topic}</h1>
                  <p className="mt-1 text-sm text-gray-500">Gửi lúc {formatDateTime(selectedMessage.createdAt)}</p>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Trạng thái</span>
                  <select
                    value={selectedMessage.status}
                    onChange={(event) => updateStatus(event.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-black"
                  >
                    {statusOptions.filter((item) => item.value !== "all").map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoCard icon={User} label="Khách hàng" value={selectedMessage.fullName} />
                <InfoCard icon={Mail} label="Email" value={selectedMessage.email} href={`mailto:${selectedMessage.email}`} />
                <InfoCard icon={Phone} label="Số điện thoại" value={selectedMessage.phone} href={`tel:${selectedMessage.phone}`} />
                <InfoCard icon={Inbox} label="Mã đơn hàng" value={selectedMessage.orderCode || "Không cung cấp"} />
              </div>

              <article className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-gray-500">Nội dung khách gửi</h2>
                <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{selectedMessage.message}</p>
              </article>

              <section className="grid gap-4">
                <div className="flex items-center gap-2">
                  <MessageSquareReply className="h-5 w-5 text-gray-500" />
                  <h2 className="text-lg font-bold text-black">Phản hồi</h2>
                </div>

                {selectedMessage.replies?.length ? (
                  <div className="grid gap-3">
                    {selectedMessage.replies.map((reply) => (
                      <article key={reply._id || reply.createdAt} className="rounded-xl border border-gray-200 p-4">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-bold text-black">{reply.repliedByName || "Admin"}</span>
                          <span className="text-xs text-gray-400">{formatDateTime(reply.createdAt)}</span>
                        </div>
                        {reply.subject ? (
                          <p className="mb-2 text-sm font-semibold text-gray-900">{reply.subject}</p>
                        ) : null}
                        <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700">{reply.message}</p>
                        <p className="mt-3 text-xs font-semibold text-emerald-600">
                          Đã gửi email cho khách hàng
                        </p>
                      </article>
                    ))}
                  </div>
                ) : null}

                <form onSubmit={submitReply} className="rounded-xl border border-gray-200 p-4">
                  <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-black">Gửi đến</span>
                      <input
                        value={selectedMessage.email}
                        readOnly
                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 outline-none"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-black">Tiêu đề email</span>
                      <input
                        value={replyForm.subject}
                        onChange={(event) =>
                          setReplyForm((current) => ({ ...current, subject: event.target.value }))
                        }
                        className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                        placeholder="FashionStore phản hồi yêu cầu..."
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-black">Nội dung phản hồi</span>
                    <textarea
                      value={replyForm.message}
                      onChange={(event) =>
                        setReplyForm((current) => ({ ...current, message: event.target.value }))
                      }
                      className="min-h-[160px] w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-black"
                      placeholder="Nhập phản hồi cho khách hàng..."
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={replying}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-black px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-500"
                  >
                    {replying ? "Đang gửi..." : "Gửi phản hồi"}
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </section>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}

function InfoCard({ icon: Icon, label, value, href }) {
  const content = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-600">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
        <span className="mt-1 block truncate text-sm font-semibold text-black">{value}</span>
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-black">
        {content}
      </a>
    );
  }

  return <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">{content}</div>;
}
