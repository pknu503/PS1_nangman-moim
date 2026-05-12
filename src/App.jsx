import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Home,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Mail,
  Megaphone,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  User,
  Users,
} from "lucide-react";

const DB = "https://ps1nangman-default-rtdb.firebaseio.com";
const ADMIN_ID = "50325";
const ADMIN_PW = "27341004";
const YEARS = Array.from({ length: 41 }, (_, index) => 2010 + index);

const STORAGE = {
  user: "nm_user",
  admin: "nm_admin",
  members: "nm_members",
  posts: "nm_posts",
  promos: "nm_promos",
  schedules: "nm_schedules",
  events: "nm_events",
  attendance: "nm_attend",
  outputs: "nm_outputs",
  resources: "nm_resources",
  messages: "nm_messages",
  messageReads: "nm_message_reads",
  pwRequests: "nm_pwreq",
  signupRequests: "nm_signup_requests",
  withdrawals: "nm_withdrawals",
};

const CLUBS = {
  hora: {
    id: "hora",
    name: "오라",
    english: "Hora",
    boardName: "오라타임",
    color: "#7d65b3",
    bg: "#f1edf9",
    image: "/assets/hora.jpg",
    description: "사람과 함께, 의미 있는 시간을 나누는 HORA",
  },
  myth: {
    id: "myth",
    name: "클럽신화",
    english: "MYTH",
    boardName: "신화창조",
    color: "#bd6538",
    bg: "#fff0e8",
    image: "/assets/myth.jpg",
    description: "신념을 이야기하고, 아이디어로 세상을 변화시키는 동아리",
  },
  theme: {
    id: "theme",
    name: "띰",
    english: "Theme",
    boardName: "테마찾기",
    color: "#3f73bc",
    bg: "#eaf1fb",
    image: "/assets/theme.png",
    description: "틀에 얽매이지 않고 우리만의 THEME를 만들어 가는 동아리",
  },
};

const CLUB_LIST = Object.values(CLUBS);
const EMPTY_DATA = {
  members: [],
  posts: [],
  promos: [],
  schedules: [],
  events: [],
  attendance: [],
  outputs: [],
  resources: [],
  messages: [],
  messageReads: [],
  pwRequests: [],
  signupRequests: [],
  withdrawals: [],
};

export default function App() {
  const [data, setData] = useState(readLocalData);
  const [user, setUser] = useState(() => readStorage(STORAGE.user, null));
  const [isAdmin, setIsAdmin] = useState(() => readStorage(STORAGE.admin, false));
  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState(user ? "home" : "auth");
  const [selectedClubId, setSelectedClubId] = useState("hora");
  const [clubTab, setClubTab] = useState("board");
  const [adminTab, setAdminTab] = useState("members");
  const [integratedTab, setIntegratedTab] = useState("overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const userRef = useRef(user);
  const adminRef = useRef(isAdmin);

  useEffect(() => {
    userRef.current = user;
    writeStorage(STORAGE.user, user);
  }, [user]);

  useEffect(() => {
    adminRef.current = isAdmin;
    writeStorage(STORAGE.admin, isAdmin);
  }, [isAdmin]);

  useEffect(() => {
    saveLocalData(data);
  }, [data]);

  useEffect(() => {
    refreshData({ silent: true });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setInterval(() => {
      if (isEditingField()) return;
      refreshData({ silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [user]);

  const sessionUser = useMemo(() => {
    if (!user || isAdmin) return user;
    return data.members.find((member) => member.id === user.id) || user;
  }, [data.members, isAdmin, user]);

  const myClubIds = isAdmin
    ? CLUB_LIST.map((club) => club.id)
    : sessionUser?.clubs || [];
  const selectedClub = CLUBS[selectedClubId] || CLUBS.hora;
  const stats = useMemo(() => buildStats(data), [data]);
  const visibleMessages = useMemo(
    () => getVisibleMessages(data.messages || [], sessionUser, isAdmin),
    [data.messages, isAdmin, sessionUser],
  );
  const unreadMessageCount = isAdmin ? 0 : visibleMessages.filter((item) => !isMessageRead(data.messageReads || [], sessionUser?.id, item.id)).length;
  const pendingPwCount = data.pwRequests.filter((req) => req.status === "pending").length;
  const pendingSignupCount = data.signupRequests.filter((req) => req.approvalStatus === "pending").length;

  async function refreshData({ silent = false } = {}) {
    if (!silent) setLoading(true);
    try {
      const remote = await fetchRemoteData();
      const fixed = reconcileSession(remote, userRef.current, adminRef.current);
      setData(fixed.data);
      if (fixed.user !== userRef.current) setUser(fixed.user);
      if (fixed.repairMember) {
        persistMember(fixed.repairMember).catch(console.warn);
      }
      return fixed.data;
    } catch (err) {
      console.error(err);
      if (!silent) setError("Firebase 데이터를 불러오지 못했습니다.");
      return data;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function login(form) {
    clearAlerts();
    if (!form.name.trim() || !form.password.trim()) {
      setError("이름과 비밀번호를 입력해주세요. 비밀번호는 숫자 8자리입니다.");
      return;
    }

    if (form.name.trim() === ADMIN_ID && form.password.trim() === ADMIN_PW) {
      setLoading(true);
      const remote = await fetchRemoteData().catch(() => data);
      setData(remote);
      setUser({
        id: "admin",
        name: "관리자",
        studentYear: "관리자",
        clubs: CLUB_LIST.map((club) => club.id),
      });
      setIsAdmin(true);
      setPage("home");
      setLoading(false);
      return;
    }

    if (!/^\d{8}$/.test(form.password.trim())) {
      setError("일반 회원 비밀번호는 숫자 8자리입니다.");
      return;
    }

    setLoading(true);
    try {
      const remote = await fetchRemoteData();
      setData(remote);
      const member = pickLatestMember(
        remote.members.filter(
          (item) => item.name === form.name.trim() && item.password === form.password.trim(),
        ),
      );
      if (!member) {
        const matchingRequest = pickLatestRequest(
          remote.signupRequests.filter(
            (item) => item.name === form.name.trim() && item.password === form.password.trim(),
          ),
        );
        if (matchingRequest?.approvalStatus === "pending") {
          setError("가입 신청이 아직 관리자 승인 대기 중입니다.");
          return;
        }
        if (matchingRequest?.approvalStatus === "rejected") {
          setError("가입 신청이 거부되었습니다. 관리자에게 문의해주세요.");
          return;
        }
        setError("이름 또는 비밀번호가 일치하지 않습니다.");
        return;
      }
      setUser(member);
      setIsAdmin(false);
      setPage("home");
      setMessage(`${member.name}님, 로그인되었습니다.`);
    } catch (err) {
      console.error(err);
      setError("로그인 중 Firebase 연결에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function register(form) {
    clearAlerts();
    if (!form.name.trim()) return setError("이름을 입력해주세요.");
    if (!form.studentYear) return setError("학번을 선택해주세요.");
    if (form.clubs.length === 0) return setError("동아리를 선택해주세요.");
    if (!/^\d{8}$/.test(form.password)) return setError("비밀번호는 숫자 8자리여야 합니다.");
    if (form.password !== form.passwordConfirm) return setError("비밀번호가 일치하지 않습니다.");

    setLoading(true);
    try {
      const remote = await fetchRemoteData();
      const duplicate = remote.members.some(
        (member) =>
          member.name === form.name.trim() &&
          String(member.studentYear) === String(form.studentYear),
      );
      if (duplicate) {
        setError("이미 등록된 이름+학번 조합입니다.");
        return;
      }

      const pendingRequest = remote.signupRequests.some(
        (request) =>
          request.approvalStatus === "pending" &&
          request.name === form.name.trim() &&
          String(request.studentYear) === String(form.studentYear),
      );
      if (pendingRequest) {
        setError("이미 관리자 승인 대기 중인 가입 신청이 있습니다.");
        return;
      }

      const request = {
        id: makeId("signup"),
        name: form.name.trim(),
        studentYear: form.studentYear,
        gender: form.gender,
        status: form.status,
        clubs: form.clubs,
        password: form.password,
        approvalStatus: "pending",
        requestedAt: now(),
        createdAt: now(),
      };
      await fbPatch("signupRequests", { [firebaseKey(request.id)]: cleanFirebase(request) });
      setData({
        ...remote,
        signupRequests: [request, ...remote.signupRequests],
      });
      setAuthMode("login");
      setMessage("가입 신청이 전송되었습니다. 관리자가 승인하면 로그인할 수 있습니다.");
    } catch (err) {
      console.error(err);
      setError("가입 신청을 Firebase에 저장하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(form) {
    clearAlerts();
    if (!sessionUser) return;
    if (!form.name.trim()) throw new Error("이름을 입력해주세요.");
    if (form.clubs.length === 0) throw new Error("동아리를 선택해주세요.");

    const duplicate = data.members.some(
      (member) =>
        member.id !== sessionUser.id &&
        member.name === form.name.trim() &&
        String(member.studentYear) === String(form.studentYear),
    );
    if (duplicate) throw new Error("같은 이름+학번 조합이 이미 존재합니다.");

    const updated = {
      ...sessionUser,
      name: form.name.trim(),
      studentYear: form.studentYear,
      gender: form.gender,
      status: form.status,
      clubs: form.clubs,
      updatedAt: now(),
    };

    setUser(updated);
    setData((current) => ({
      ...current,
      members: upsertById(current.members, updated),
    }));
    await persistMember(updated);
    const saved = await fbGet(`members/${firebaseRecordKey(updated, updated.id)}`);
    if (!saved) throw new Error("Firebase 저장 확인에 실패했습니다.");
    setMessage("정보가 저장되었습니다. 다시 로그인해도 수정한 정보가 유지됩니다.");
  }

  async function changePassword(form) {
    clearAlerts();
    if (form.oldPassword !== sessionUser.password) throw new Error("현재 비밀번호가 일치하지 않습니다.");
    if (!/^\d{8}$/.test(form.newPassword)) throw new Error("새 비밀번호는 숫자 8자리여야 합니다.");
    if (form.newPassword !== form.confirmPassword) throw new Error("새 비밀번호가 일치하지 않습니다.");
    const updated = { ...sessionUser, password: form.newPassword, updatedAt: now() };
    setUser(updated);
    setData((current) => ({ ...current, members: upsertById(current.members, updated) }));
    await persistMember(updated);
    setMessage("비밀번호가 변경되었습니다.");
  }

  async function addPost(content, anonymous) {
    if (!content.trim()) return;
    const item = {
      id: makeId("post"),
      clubId: selectedClubId,
      authorId: sessionUser.id,
      authorName: anonymous ? "익명" : sessionUser.name,
      isAnon: anonymous,
      content: content.trim(),
      createdAt: now(),
    };
    setData((current) => ({ ...current, posts: [item, ...current.posts] }));
    await fbPatch("posts", { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function addPromo(form) {
    const clubIds = form.clubId === "all" ? CLUB_LIST.map((club) => club.id) : [form.clubId];
    const newPromos = clubIds.map((clubId) => ({
      id: makeId("promo"),
      clubId,
      title: form.title.trim(),
      content: form.content.trim(),
      authorId: sessionUser.id,
      authorName: sessionUser.name,
      isGlobal: form.clubId === "all",
      createdAt: now(),
    }));
    if (!form.title.trim() || !form.content.trim()) return;
    setData((current) => ({ ...current, promos: [...newPromos, ...current.promos] }));
    await fbPatch("promos", Object.fromEntries(newPromos.map((item) => [firebaseKey(item.id), cleanFirebase(item)])));
  }

  async function updateRecord(collection, record, changes) {
    const updated = {
      ...record,
      ...changes,
      editedAt: now(),
      updatedAt: now(),
    };
    setData((current) => ({
      ...current,
      [collection]: upsertById(current[collection] || [], updated),
    }));
    await fbPatch(collection, { [firebaseRecordKey(record, record.id)]: cleanFirebase(updated) });
  }

  async function addSchedule(collection, form) {
    if (!form.title.trim()) return;
    const item = {
      id: makeId(collection),
      clubId: selectedClubId,
      title: form.title.trim(),
      date: form.date,
      kind: form.kind || "",
      description: form.description.trim(),
      createdAt: now(),
    };
    setData((current) => ({ ...current, [collection]: [item, ...current[collection]] }));
    await fbPatch(collection, { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function markAttendance(memberId, date, status) {
    const key = `${selectedClubId}_${memberId}_${date}`;
    const item = { key, clubId: selectedClubId, memberId, date, status, updatedAt: now() };
    setData((current) => ({ ...current, attendance: upsertByKey(current.attendance, item, "key") }));
    await fbPatch("attendance", { [firebaseKey(key)]: cleanFirebase(item) });
  }

  async function addResource(form) {
    if (!form.title.trim()) return;
    const item = {
      id: makeId("resource"),
      clubId: form.clubId,
      type: form.type,
      title: form.title.trim(),
      note: form.note.trim(),
      imageUrl: form.imageUrl,
      createdAt: now(),
    };
    setData((current) => ({ ...current, resources: [item, ...current.resources] }));
    await fbPatch("resources", { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function addOutput(form) {
    if (!form.title.trim() && !form.content.trim() && !form.fileUrl) return;
    const item = {
      id: makeId("output"),
      clubId: selectedClubId,
      title: form.title.trim() || "동아리 성과",
      content: form.content.trim(),
      fileUrl: form.fileUrl || "",
      fileName: form.fileName || "",
      fileType: form.fileType || "",
      authorId: sessionUser.id,
      authorName: sessionUser.name,
      createdAt: now(),
    };
    setData((current) => ({ ...current, outputs: [item, ...current.outputs] }));
    await fbPatch("outputs", { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function sendMessage(form) {
    if (!form.content.trim()) return;
    const recipient = form.recipientId === "all"
      ? null
      : data.members.find((member) => member.id === form.recipientId);
    if (form.recipientId !== "all" && !recipient) throw new Error("쪽지를 받을 회원을 선택해주세요.");
    const item = {
      id: makeId("message"),
      recipientId: form.recipientId,
      recipientName: recipient ? memberLabel(recipient) : "전체 회원",
      scope: form.recipientId === "all" ? "all" : "member",
      title: form.title.trim() || "관리자 쪽지",
      content: form.content.trim(),
      senderId: "admin",
      senderName: "관리자",
      createdAt: now(),
    };
    setData((current) => ({ ...current, messages: [item, ...current.messages] }));
    await fbPatch("messages", { [firebaseKey(item.id)]: cleanFirebase(item) });
    setMessage("쪽지를 보냈습니다.");
  }

  async function sendAdminMessage(form) {
    if (!sessionUser?.id || !form.content.trim()) return;
    const item = {
      id: makeId("message"),
      recipientId: "admin",
      recipientName: "관리자",
      scope: "toAdmin",
      title: form.title.trim() || "관리자에게 보낸 쪽지",
      content: form.content.trim(),
      senderId: sessionUser.id,
      senderName: memberLabel(sessionUser),
      senderStudentYear: sessionUser.studentYear,
      createdAt: now(),
    };
    setData((current) => ({ ...current, messages: [item, ...current.messages] }));
    await fbPatch("messages", { [firebaseKey(item.id)]: cleanFirebase(item) });
    setMessage("관리자에게 쪽지를 보냈습니다.");
  }

  async function markMessagesRead(messages) {
    if (!sessionUser?.id || isAdmin || messages.length === 0) return;
    const unread = messages.filter((item) => !isMessageRead(data.messageReads || [], sessionUser.id, item.id));
    if (unread.length === 0) return;
    const reads = unread.map((item) => ({
      key: `${sessionUser.id}_${item.id}`,
      memberId: sessionUser.id,
      messageId: item.id,
      readAt: now(),
    }));
    setData((current) => ({
      ...current,
      messageReads: reads.reduce(
        (list, item) => upsertByKey(list, item, "key"),
        current.messageReads || [],
      ),
    }));
    await fbPatch("messageReads", Object.fromEntries(reads.map((item) => [firebaseKey(item.key), cleanFirebase(item)])));
  }

  async function submitPwRequest(msg) {
    const exists = data.pwRequests.find(
      (req) => req.memberId === sessionUser.id && req.status === "pending",
    );
    if (exists) {
      setError("이미 처리 대기 중인 요청이 있습니다.");
      return;
    }
    const item = {
      id: makeId("pwreq"),
      memberId: sessionUser.id,
      memberName: sessionUser.name,
      studentYear: sessionUser.studentYear,
      message: msg.trim(),
      status: "pending",
      adminReply: "",
      createdAt: now(),
    };
    setData((current) => ({ ...current, pwRequests: [item, ...current.pwRequests] }));
    await fbPatch("pwRequests", { [firebaseKey(item.id)]: cleanFirebase(item) });
    setMessage("비밀번호 찾기 요청을 관리자에게 보냈습니다.");
  }

  async function replyPwRequest(req, reply) {
    const updated = { ...req, status: "done", adminReply: reply.trim(), repliedAt: now() };
    setData((current) => ({ ...current, pwRequests: upsertById(current.pwRequests, updated) }));
    await fbPatch("pwRequests", { [firebaseRecordKey(req, req.id)]: cleanFirebase(updated) });
  }

  async function approveSignupRequest(req) {
    const latest = await fetchRemoteData().catch(() => data);
    const duplicate = latest.members.some(
      (member) =>
        member.name === req.name &&
        String(member.studentYear) === String(req.studentYear),
    );
    if (duplicate) {
      throw new Error("이미 같은 이름+학번 회원이 존재합니다.");
    }

    const member = {
      id: makeId("member"),
      name: req.name,
      studentYear: req.studentYear,
      gender: req.gender,
      status: req.status,
      clubs: req.clubs || [],
      password: req.password,
      joinedAt: now(),
      updatedAt: now(),
      approvedFromRequestId: req.id,
    };
    const reviewed = {
      ...req,
      approvalStatus: "approved",
      reviewedAt: now(),
    };
    await persistMember(member);
    await fbPatch("signupRequests", { [firebaseRecordKey(req, req.id)]: cleanFirebase(reviewed) });
    setData((current) => ({
      ...current,
      members: upsertById(current.members, member),
      signupRequests: upsertById(current.signupRequests, reviewed),
    }));
    setMessage(`${req.name}님의 가입을 승인했습니다.`);
  }

  async function rejectSignupRequest(req, reason) {
    const reviewed = {
      ...req,
      approvalStatus: "rejected",
      rejectReason: reason.trim() || "관리자 거부",
      reviewedAt: now(),
    };
    await fbPatch("signupRequests", { [firebaseRecordKey(req, req.id)]: cleanFirebase(reviewed) });
    setData((current) => ({
      ...current,
      signupRequests: upsertById(current.signupRequests, reviewed),
    }));
    setMessage(`${req.name}님의 가입 신청을 거부했습니다.`);
  }

  async function restoreSignupRequest(req) {
    const restored = {
      ...req,
      approvalStatus: "pending",
      rejectReason: "",
      reviewedAt: "",
      updatedAt: now(),
    };
    await fbPatch("signupRequests", { [firebaseRecordKey(req, req.id)]: cleanFirebase(restored) });
    setData((current) => ({
      ...current,
      signupRequests: upsertById(current.signupRequests, restored),
    }));
    setMessage(`${req.name}님의 가입 거부를 취소했습니다.`);
  }

  async function forceWithdraw(member, reason) {
    if (!reason.trim()) throw new Error("탈퇴 사유를 입력해주세요.");
    const item = {
      id: makeId("withdraw"),
      memberId: member.id,
      memberName: member.name,
      studentYear: member.studentYear,
      clubs: member.clubs || [],
      status: member.status || "active",
      reason: reason.trim(),
      withdrawnAt: now(),
      withdrawnBy: "관리자",
    };
    setData((current) => ({
      ...current,
      members: current.members.filter((m) => m.id !== member.id),
      withdrawals: [item, ...current.withdrawals],
    }));
    await fbPatch("withdrawals", { [firebaseKey(item.id)]: cleanFirebase(item) });
    await fbDelete(`members/${firebaseRecordKey(member, member.id)}`);
  }

  async function deleteRecord(collection, record) {
    if (!window.confirm("삭제할까요?")) return;
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== record.id && item.key !== record.key),
    }));
    await fbDelete(`${collection}/${firebaseRecordKey(record, record.id || record.key)}`);
  }

  function openClub(clubId) {
    setSelectedClubId(clubId);
    setClubTab("board");
    setPage("club");
  }

  function logout() {
    setUser(null);
    setIsAdmin(false);
    setAuthMode("login");
    setPage("auth");
    setMessage("로그아웃되었습니다.");
  }

  function clearAlerts() {
    setError("");
    setMessage("");
  }

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        login={login}
        register={register}
        loading={loading}
        error={error}
        message={message}
      />
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("home")}>
          <span>PS1</span>
          <strong>낭만모임</strong>
        </button>
        <nav>
          <NavButton id="home" page={page} setPage={setPage} icon={Home} label="홈" />
          <NavButton id="integrated" page={page} setPage={setPage} icon={BarChart3} label="통합현황" />
          <NavButton id="club" page={page} setPage={setPage} icon={Users} label="동아리" />
          {isAdmin && <NavButton id="admin" page={page} setPage={setPage} icon={ShieldCheck} label={`관리자${pendingPwCount + pendingSignupCount ? ` ${pendingPwCount + pendingSignupCount}` : ""}`} />}
          {!isAdmin && <NavButton id="profile" page={page} setPage={setPage} icon={User} label="내 정보" />}
          {!isAdmin && <NavButton id="messages" page={page} setPage={setPage} icon={Mail} label={`쪽지함${unreadMessageCount ? ` ${unreadMessageCount}` : ""}`} highlight={unreadMessageCount > 0} />}
        </nav>
        <div className="session">
          <span>{isAdmin ? "관리자" : sessionUser?.name}</span>
          <button type="button" onClick={logout}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </header>

      {(message || error) && <div className={error ? "alert error" : "alert"}>{error || message}</div>}

      {page === "home" && (
        <HomePage
          data={data}
          isAdmin={isAdmin}
          user={sessionUser}
          myClubIds={myClubIds}
          openClub={openClub}
          addPromo={addPromo}
          deletePromo={(promo) => deleteRecord("promos", promo)}
          updatePromo={(promo, changes) => updateRecord("promos", promo, changes)}
        />
      )}
      {page === "integrated" && (
        <IntegratedPage
          data={data}
          stats={stats}
          tab={integratedTab}
          setTab={setIntegratedTab}
          loading={loading}
          refresh={() => refreshData()}
        />
      )}
      {page === "club" && (
        <ClubPage
          data={data}
          user={sessionUser}
          isAdmin={isAdmin}
          selectedClub={selectedClub}
          selectedClubId={selectedClubId}
          openClub={openClub}
          tab={clubTab}
          setTab={setClubTab}
          addPost={addPost}
          deletePost={(post) => deleteRecord("posts", post)}
          updatePost={(post, changes) => updateRecord("posts", post, changes)}
          deletePromo={(promo) => deleteRecord("promos", promo)}
          updatePromo={(promo, changes) => updateRecord("promos", promo, changes)}
          addSchedule={addSchedule}
          updateSchedule={(collection, record, changes) => updateRecord(collection, record, changes)}
          deleteSchedule={(collection, record) => deleteRecord(collection, record)}
          addOutput={addOutput}
          updateOutput={(output, changes) => updateRecord("outputs", output, changes)}
          deleteOutput={(output) => deleteRecord("outputs", output)}
          markAttendance={markAttendance}
        />
      )}
      {page === "profile" && !isAdmin && (
        <ProfilePage
          data={data}
          user={sessionUser}
          saveProfile={saveProfile}
          changePassword={changePassword}
          submitPwRequest={submitPwRequest}
        />
      )}
      {page === "messages" && !isAdmin && (
        <MessagesPage
          messages={visibleMessages}
          sentMessages={(data.messages || []).filter((item) => item.senderId === sessionUser.id && item.recipientId === "admin").sort(sortNewest)}
          messageReads={data.messageReads || []}
          user={sessionUser}
          sendAdminMessage={sendAdminMessage}
          markMessagesRead={markMessagesRead}
        />
      )}
      {page === "admin" && isAdmin && (
        <AdminPage
          data={data}
          stats={stats}
          tab={adminTab}
          setTab={setAdminTab}
          deleteRecord={deleteRecord}
          addResource={addResource}
          replyPwRequest={replyPwRequest}
          approveSignupRequest={approveSignupRequest}
          rejectSignupRequest={rejectSignupRequest}
          restoreSignupRequest={restoreSignupRequest}
          updateRecord={updateRecord}
          sendMessage={sendMessage}
          forceWithdraw={forceWithdraw}
          refresh={() => refreshData()}
        />
      )}
    </main>
  );
}

function AuthScreen({ mode, setMode, login, register, loading, error, message }) {
  return (
    <main className="auth">
      <section className="auth-card">
        <h1>낭만모임</h1>
        <p>부경대 사회복지 전공동아리</p>
        <ClubImageGrid compact />
        <div className="notice">
          일반 회원 비밀번호는 <strong>숫자 8자리</strong>입니다. 예: 생년월일 8자리
          <br />
          신규 가입은 관리자 승인 후 로그인할 수 있습니다.
        </div>
        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>로그인</button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>신규 가입</button>
        </div>
        {(message || error) && <div className={error ? "alert error" : "alert"}>{error || message}</div>}
        {mode === "login" ? <LoginForm login={login} loading={loading} /> : <RegisterForm register={register} loading={loading} />}
      </section>
    </main>
  );
}

function LoginForm({ login, loading }) {
  const [form, setForm] = useState({ name: "", password: "" });
  return (
    <form className="form" onSubmit={(event) => { event.preventDefault(); login(form); }}>
      <label>
        이름 또는 관리자 ID
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="이름 입력" />
      </label>
      <label>
        비밀번호
        <PasswordInput
          maxLength={8}
          value={form.password}
          onChange={(value) => setForm({ ...form, password: value.replace(/\D/g, "") })}
          placeholder="숫자 8자리"
        />
      </label>
      <button className="primary" disabled={loading} type="submit">로그인</button>
    </form>
  );
}

function PasswordInput({ value, onChange, placeholder, maxLength = 8 }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input
        type={visible ? "text" : "password"}
        inputMode="numeric"
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        title={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function RegisterForm({ register, loading }) {
  const [form, setForm] = useState({
    name: "",
    studentYear: "",
    gender: "female",
    status: "active",
    clubs: [],
    password: "",
    passwordConfirm: "",
  });

  function toggleClub(clubId) {
    setForm((current) => ({
      ...current,
      clubs: current.clubs.includes(clubId)
        ? current.clubs.filter((id) => id !== clubId)
        : [...current.clubs, clubId],
    }));
  }

  return (
    <form className="form" onSubmit={(event) => { event.preventDefault(); register(form); }}>
      <label>
        이름
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="실명 입력" />
      </label>
      <div className="two">
        <label>
          학번
          <select value={form.studentYear} onChange={(event) => setForm({ ...form, studentYear: event.target.value })}>
            <option value="">선택</option>
            {YEARS.map((year) => <option key={year} value={year}>{year}학번</option>)}
          </select>
        </label>
        <label>
          성별
          <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
            <option value="female">여성</option>
            <option value="male">남성</option>
            <option value="other">기타</option>
          </select>
        </label>
      </div>
      <label>
        재적 상태
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
          <option value="active">현역 PS1</option>
          <option value="graduated">졸업생 PS0</option>
        </select>
      </label>
      <ClubPicker selected={form.clubs} toggle={toggleClub} imageMode />
      <div className="notice">비밀번호는 반드시 <strong>숫자 8자리</strong>로 설정해주세요.</div>
      <div className="two">
        <label>
          비밀번호
          <PasswordInput
            maxLength={8}
            value={form.password}
            onChange={(value) => setForm({ ...form, password: value.replace(/\D/g, "") })}
            placeholder="숫자 8자리"
          />
        </label>
        <label>
          비밀번호 확인
          <PasswordInput
            maxLength={8}
            value={form.passwordConfirm}
            onChange={(value) => setForm({ ...form, passwordConfirm: value.replace(/\D/g, "") })}
            placeholder="다시 입력"
          />
        </label>
      </div>
      <button className="primary" disabled={loading} type="submit">가입 신청하기</button>
    </form>
  );
}

function HomePage({ data, isAdmin, user, myClubIds, openClub, addPromo, deletePromo, updatePromo }) {
  const writableClubs = isAdmin ? CLUB_LIST : CLUB_LIST.filter((club) => user.clubs?.includes(club.id));
  const visiblePromos = isAdmin ? data.promos : data.promos.filter((promo) => myClubIds.includes(promo.clubId));

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p>국립부경대학교 사회복지학과(PS1) 전공동아리</p>
          <h1>낭만 있는 사복 이야기</h1>
        </div>
        <div className="hero-clubs">
          <ClubImageGrid onClick={openClub} counts={data.members} />
          <span>동아리 그림을 클릭해서 각 동아리 관리 화면으로 이동하세요.</span>
        </div>
      </section>

      {writableClubs.length > 0 && (
        <PromoComposer writableClubs={writableClubs} addPromo={addPromo} />
      )}

      <section className="panel">
        <h2><Megaphone size={19} /> 홍보 게시판</h2>
        <PostList posts={visiblePromos} isAdmin={isAdmin} currentUser={user} deletePost={deletePromo} updatePost={updatePromo} isPromo />
      </section>
    </div>
  );
}

function PromoComposer({ writableClubs, addPromo }) {
  const [form, setForm] = useState({ clubId: writableClubs[0]?.id || "hora", title: "", content: "" });
  const options = [{ id: "all", name: "전체 공지" }, ...writableClubs];

  return (
    <section className="panel">
      <h2><Megaphone size={19} /> 홍보글 작성</h2>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          addPromo(form);
          setForm({ ...form, title: "", content: "" });
        }}
      >
        <label>
          홍보 대상
          <select value={form.clubId} onChange={(event) => setForm({ ...form, clubId: event.target.value })}>
            {options.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
        </label>
        {form.clubId === "all" && <div className="notice">전체 공지는 각 동아리 홍보 게시판에 동시에 올라갑니다.</div>}
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
        <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
        <button className="primary" type="submit"><Plus size={17} /> 등록</button>
      </form>
    </section>
  );
}

function IntegratedPage({ data, stats, tab, setTab, loading, refresh }) {
  return (
    <div className="stack">
      <section className="toolbar">
        <h1>통합 현황</h1>
        <button type="button" onClick={refresh}><RefreshCw size={16} /> {loading ? "불러오는 중" : "새로고침"}</button>
      </section>
      <div className="tabs">
        <button className={tab === "overview" ? "active" : ""} type="button" onClick={() => setTab("overview")}>전체 지표</button>
        <button className={tab === "compare" ? "active" : ""} type="button" onClick={() => setTab("compare")}>동아리 비교</button>
        <button className={tab === "members" ? "active" : ""} type="button" onClick={() => setTab("members")}>전체 회원</button>
      </div>
      {tab === "overview" && <OverviewStats data={data} stats={stats} />}
      {tab === "compare" && <CompareStats stats={stats} />}
      {tab === "members" && (
        <section className="panel">
          <h2><Users size={19} /> 전체 회원</h2>
          <MemberTable members={data.members} />
        </section>
      )}
    </div>
  );
}

function OverviewStats({ data, stats }) {
  return (
    <>
      <div className="metrics">
        <Metric label="전체 회원" value={`${data.members.length}명`} />
        <Metric label="게시글" value={`${data.posts.length}개`} />
        <Metric label="홍보글" value={`${data.promos.length}개`} />
        <Metric label="성과" value={`${(data.outputs || []).length}개`} />
        <Metric label="자료" value={`${data.resources.length}개`} />
      </div>
      <DashboardGraphs data={data} stats={stats} />
      <section className="panel">
        <h2><BarChart3 size={19} /> 동아리별 지표</h2>
        <div className="chart-grid">
          {stats.map((stat) => (
            <article className="chart-card" key={stat.club.id}>
              <ClubBadge clubId={stat.club.id} />
              <Bar label="회원" value={stat.members} max={Math.max(1, ...stats.map((s) => s.members))} color={stat.club.color} suffix="명" />
              <Bar label="게시물" value={stat.posts} max={Math.max(1, ...stats.map((s) => s.posts))} color={stat.club.color} suffix="개" />
              <Bar label="출석률" value={stat.attendanceRate} max={100} color={stat.club.color} suffix="%" />
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function DashboardGraphs({ data, stats }) {
  const totals = {
    posts: data.posts.length,
    promos: data.promos.length,
    outputs: (data.outputs || []).length,
    resources: data.resources.length,
  };
  const maxMembers = Math.max(1, ...stats.map((stat) => stat.members));
  const maxContent = Math.max(1, ...Object.values(totals));
  return (
    <section className="panel">
      <h2><BarChart3 size={19} /> 그래프 요약</h2>
      <div className="graph-grid">
        <article className="graph-card">
          <strong>동아리별 회원 수</strong>
          <div className="vertical-bars">
            {stats.map((stat) => (
              <div className="vertical-bar" key={stat.club.id}>
                <span style={{ height: `${Math.max(8, Math.round((stat.members / maxMembers) * 100))}%`, background: stat.club.color }} />
                <small>{stat.members}명</small>
                <ClubBadge clubId={stat.club.id} />
              </div>
            ))}
          </div>
        </article>
        <article className="graph-card">
          <strong>콘텐츠 등록 현황</strong>
          <Bar label="게시글" value={totals.posts} max={maxContent} color="#7d65b3" suffix="개" />
          <Bar label="홍보글" value={totals.promos} max={maxContent} color="#f28b8b" suffix="개" />
          <Bar label="성과" value={totals.outputs} max={maxContent} color="#bd6538" suffix="개" />
          <Bar label="자료" value={totals.resources} max={maxContent} color="#3f73bc" suffix="개" />
        </article>
        <article className="graph-card">
          <strong>출석률 다이어그램</strong>
          <div className="donut-grid">
            {stats.map((stat) => (
              <div className="donut-item" key={stat.club.id}>
                <div
                  className="donut"
                  style={{
                    "--value": `${stat.attendanceRate}%`,
                    "--club": stat.club.color,
                  }}
                >
                  <span>{stat.attendanceRate}%</span>
                </div>
                <ClubBadge clubId={stat.club.id} />
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function CompareStats({ stats }) {
  const max = Math.max(1, ...stats.flatMap((stat) => [stat.members, stat.posts, stat.promos, stat.outputs, stat.resources]));
  return (
    <section className="panel">
      <h2><BarChart3 size={19} /> 동아리별 비교</h2>
      <ComparisonSummary stats={stats} />
      <div className="compare-bars">
        {stats.map((stat) => (
          <article className="chart-card" key={stat.club.id}>
            <ClubBadge clubId={stat.club.id} />
            <Bar label="회원" value={stat.members} max={max} color={stat.club.color} suffix="명" />
            <Bar label="게시글" value={stat.posts} max={max} color="#7d65b3" suffix="개" />
            <Bar label="홍보글" value={stat.promos} max={max} color="#f28b8b" suffix="개" />
            <Bar label="성과" value={stat.outputs} max={max} color="#bd6538" suffix="개" />
            <Bar label="자료" value={stat.resources} max={max} color="#3f73bc" suffix="개" />
          </article>
        ))}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>동아리</th>
              <th>회원 수</th>
              <th>현역</th>
              <th>졸업생</th>
              <th>게시글</th>
              <th>홍보글</th>
              <th>성과</th>
              <th>출석률</th>
              <th>자료</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.club.id}>
                <td><ClubBadge clubId={stat.club.id} /></td>
                <td>{stat.members}</td>
                <td>{stat.active}</td>
                <td>{stat.graduated}</td>
                <td>{stat.posts}</td>
                <td>{stat.promos}</td>
                <td>{stat.outputs}</td>
                <td>{stat.attendanceRate}%</td>
                <td>{stat.resources}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ComparisonSummary({ stats }) {
  const metrics = [
    ["회원", "members", "명"],
    ["현역", "active", "명"],
    ["졸업생", "graduated", "명"],
    ["게시글", "posts", "개"],
    ["홍보글", "promos", "개"],
    ["성과", "outputs", "개"],
    ["자료", "resources", "개"],
    ["출석률", "attendanceRate", "%"],
  ];

  return (
    <div className="comparison-summary">
      {metrics.map(([label, key, suffix]) => (
        <article key={key}>
          <strong>{label}</strong>
          <span>{formatRanking(stats, key, suffix)}</span>
        </article>
      ))}
    </div>
  );
}

function ClubPage({ data, user, isAdmin, selectedClub, selectedClubId, openClub, tab, setTab, addPost, deletePost, updatePost, deletePromo, updatePromo, addSchedule, updateSchedule, deleteSchedule, addOutput, updateOutput, deleteOutput, markAttendance }) {
  const isMember = isAdmin || user.clubs?.includes(selectedClubId);
  const posts = data.posts.filter((post) => post.clubId === selectedClubId);
  const promos = data.promos.filter((promo) => promo.clubId === selectedClubId);
  const members = data.members.filter((member) => member.clubs?.includes(selectedClubId));
  const outputs = (data.outputs || []).filter((output) => output.clubId === selectedClubId);

  return (
    <div className="stack">
      <section className="club-hero" style={{ "--club": selectedClub.color, "--club-bg": selectedClub.bg }}>
        <img src={selectedClub.image} alt={selectedClub.name} />
        <div>
          <p>{selectedClub.english}</p>
          <h1>{selectedClub.name}</h1>
          <ClubDescription club={selectedClub} />
        </div>
      </section>
      <ClubImageGrid onClick={openClub} selectedId={selectedClubId} compact />
      {!isMember ? (
        <section className="panel">이 동아리의 회원이 아닙니다.</section>
      ) : (
        <>
          <div className="tabs">
            <button className={tab === "board" ? "active" : ""} type="button" onClick={() => setTab("board")}>게시판</button>
            <button className={tab === "promo" ? "active" : ""} type="button" onClick={() => setTab("promo")}>홍보</button>
            <button className={tab === "monthly" ? "active" : ""} type="button" onClick={() => setTab("monthly")}>월별 일정</button>
            <button className={tab === "outputs" ? "active" : ""} type="button" onClick={() => setTab("outputs")}>동아리 성과</button>
            <button className={tab === "event" ? "active" : ""} type="button" onClick={() => setTab("event")}>주별 이벤트</button>
            <button className={tab === "other" ? "active" : ""} type="button" onClick={() => setTab("other")}>기타</button>
            <button className={tab === "attendance" ? "active" : ""} type="button" onClick={() => setTab("attendance")}>출석</button>
            <button className={tab === "members" ? "active" : ""} type="button" onClick={() => setTab("members")}>회원</button>
          </div>
          {tab === "board" && <BoardPanel title={selectedClub.boardName} posts={posts} user={user} isAdmin={isAdmin} addPost={addPost} deletePost={deletePost} updatePost={updatePost} />}
          {tab === "promo" && (
            <section className="panel">
              <h2><Megaphone size={19} /> {selectedClub.name} 홍보 게시판</h2>
              <PostList posts={promos} isAdmin={isAdmin} currentUser={user} deletePost={deletePromo} updatePost={updatePromo} isPromo />
            </section>
          )}
          {tab === "monthly" && <MonthlyCalendarPanel items={data.schedules.filter((item) => item.clubId === selectedClubId && item.kind === "monthly")} canManage={isMember} addSchedule={addSchedule} updateSchedule={updateSchedule} deleteSchedule={deleteSchedule} />}
          {tab === "outputs" && <OutputPanel outputs={outputs} canManage={isMember} addOutput={addOutput} updateOutput={updateOutput} deleteOutput={deleteOutput} />}
          {tab === "event" && <SchedulePanel title="주별 이벤트" collection="events" kind="event" items={data.events.filter((item) => item.clubId === selectedClubId)} isAdmin={isAdmin} addSchedule={addSchedule} deleteSchedule={deleteSchedule} />}
          {tab === "other" && <SchedulePanel title="기타" collection="schedules" kind="other" items={data.schedules.filter((item) => item.clubId === selectedClubId && item.kind === "other")} isAdmin={isAdmin} addSchedule={addSchedule} deleteSchedule={deleteSchedule} />}
          {tab === "attendance" && <AttendancePanel data={data} members={members} user={user} isAdmin={isAdmin} clubId={selectedClubId} markAttendance={markAttendance} />}
          {tab === "members" && (
            <section className="panel">
              <h2><Users size={19} /> 회원</h2>
              <MemberTable members={members} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ClubDescription({ club }) {
  if (club.id === "myth") {
    return (
      <span>
        <strong className="orange-letter">신</strong>념을 이야기하고, 아이디어로 세상을 변<strong className="orange-letter">화</strong>시키는 동아리
      </span>
    );
  }
  if (club.id === "theme") {
    return (
      <span>
        틀에 얽매이지 않고 우리만의 <strong className="theme-letter">THEME</strong>를 만들어 가는 동아리
      </span>
    );
  }
  if (club.id === "hora") {
    return (
      <span>
        사람과 함께, 의미 있는 시간을 나누는 <strong className="hora-letter">HORA</strong>
      </span>
    );
  }
  return <span>{club.description}</span>;
}

function BoardPanel({ title, posts, user, isAdmin, addPost, deletePost, updatePost }) {
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  return (
    <section className="panel">
      <h2><FileText size={19} /> {title}</h2>
      <form className="form" onSubmit={(event) => { event.preventDefault(); addPost(content, anonymous); setContent(""); setAnonymous(false); }}>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="게시글을 남겨보세요." />
        <label className="inline">
          <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
          비밀/익명 글쓰기
        </label>
        <button className="primary" type="submit"><Plus size={17} /> 등록</button>
      </form>
      <PostList posts={posts} isAdmin={isAdmin} currentUser={user} deletePost={deletePost} updatePost={updatePost} />
    </section>
  );
}

function MonthlyCalendarPanel({ items, canManage, addSchedule, updateSchedule, deleteSchedule }) {
  const [month, setMonth] = useState(currentMonthKey());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [form, setForm] = useState({ title: "", description: "" });
  const days = useMemo(() => buildCalendarDays(month), [month]);
  const itemsByDate = useMemo(() => {
    return items.reduce((groups, item) => {
      const date = item.date || todayKey();
      groups[date] = [...(groups[date] || []), item];
      return groups;
    }, {});
  }, [items]);
  const selectedItems = [...(itemsByDate[selectedDate] || [])].sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "ko"),
  );

  function moveMonth(delta) {
    const next = addMonths(month, delta);
    setMonth(next);
    setSelectedDate(`${next}-01`);
  }

  function selectDay(day) {
    setSelectedDate(day.date);
    if (!day.currentMonth) setMonth(day.date.slice(0, 7));
  }

  return (
    <section className="panel">
      <div className="calendar-head">
        <h2><CalendarDays size={19} /> 월별 일정</h2>
        <div className="calendar-controls">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft size={17} /></button>
          <strong>{month.replace("-", ".")}</strong>
          <button type="button" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight size={17} /></button>
        </div>
      </div>
      <div className="calendar-grid">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <span className="calendar-weekday" key={day}>{day}</span>
        ))}
        {days.map((day) => {
          const count = itemsByDate[day.date]?.length || 0;
          return (
            <button
              className={[
                "calendar-day",
                day.currentMonth ? "" : "outside",
                selectedDate === day.date ? "selected" : "",
                count ? "has-item" : "",
              ].filter(Boolean).join(" ")}
              key={day.date}
              type="button"
              onClick={() => selectDay(day)}
            >
              <span>{day.label}</span>
              {count > 0 && <strong>{count}</strong>}
            </button>
          );
        })}
      </div>
      <div className="day-agenda">
        <h3>{formatDate(selectedDate)} 일정</h3>
        {canManage && (
          <form
            className="inline-form schedule-form"
            onSubmit={(event) => {
              event.preventDefault();
              addSchedule("schedules", { ...form, date: selectedDate, kind: "monthly" });
              setForm({ title: "", description: "" });
            }}
          >
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="일정 제목" />
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="메모" />
            <button className="primary" type="submit"><Plus size={17} /> 추가</button>
          </form>
        )}
        <div className="cards">
          {selectedItems.length === 0 ? (
            <p className="empty">선택한 날짜에 등록된 일정이 없습니다.</p>
          ) : selectedItems.map((item) => (
            <ScheduleItem
              key={item.id}
              item={item}
              canManage={canManage}
              updateSchedule={updateSchedule}
              deleteSchedule={deleteSchedule}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScheduleItem({ item, canManage, updateSchedule, deleteSchedule }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: item.title || "",
    date: item.date || todayKey(),
    description: item.description || "",
  });

  async function save() {
    if (!draft.title.trim()) return;
    await updateSchedule("schedules", item, {
      title: draft.title.trim(),
      date: draft.date,
      kind: "monthly",
      description: draft.description.trim(),
    });
    setEditing(false);
  }

  return (
    <article className="post">
      {editing ? (
        <div className="post-edit">
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="일정 제목" />
          <div className="two">
            <input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="메모" />
          </div>
          <div className="button-row">
            <button className="primary" type="button" onClick={save}><Save size={15} /> 저장</button>
            <button type="button" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <strong>{item.title}</strong>
          <p>{item.description || "메모 없음"}</p>
          <small>{formatDate(item.date)}</small>
          {canManage && (
            <footer>
              <span />
              <span className="post-actions">
                <button type="button" onClick={() => setEditing(true)}><Pencil size={15} /> 수정</button>
                <button type="button" onClick={() => deleteSchedule("schedules", item)}><Trash2 size={15} /> 삭제</button>
              </span>
            </footer>
          )}
        </>
      )}
    </article>
  );
}

function OutputPanel({ outputs, canManage, addOutput, updateOutput, deleteOutput }) {
  return (
    <section className="panel">
      <h2><Trophy size={19} /> 동아리 성과</h2>
      {canManage && <OutputComposer addOutput={addOutput} />}
      <div className="cards">
        {outputs.length === 0 ? (
          <p className="empty">등록된 성과가 없습니다.</p>
        ) : outputs.map((output) => (
          <OutputCard
            key={output.id}
            output={output}
            canManage={canManage}
            updateOutput={updateOutput}
            deleteOutput={deleteOutput}
          />
        ))}
      </div>
    </section>
  );
}

function OutputComposer({ addOutput }) {
  const [form, setForm] = useState({ title: "", content: "", fileUrl: "", fileName: "", fileType: "" });
  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileUrl = await readFileAsDataUrl(file);
    setForm((current) => ({
      ...current,
      fileUrl,
      fileName: file.name,
      fileType: file.type,
    }));
  }
  return (
    <form
      className="form output-form"
      onSubmit={(event) => {
        event.preventDefault();
        addOutput(form);
        setForm({ title: "", content: "", fileUrl: "", fileName: "", fileType: "" });
      }}
    >
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="성과 제목" />
      <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="성과 내용" />
      <label className="file-field">
        <Paperclip size={16} />
        <span>{form.fileName || "그림 또는 첨부파일 선택"}</span>
        <input type="file" onChange={onFile} />
      </label>
      <button className="primary" type="submit"><Plus size={17} /> 성과 등록</button>
    </form>
  );
}

function OutputCard({ output, canManage, updateOutput, deleteOutput }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: output.title || "", content: output.content || "" });
  const isImage = output.fileType?.startsWith("image/");

  async function save() {
    if (!draft.title.trim() && !draft.content.trim()) return;
    await updateOutput(output, {
      title: draft.title.trim() || "동아리 성과",
      content: draft.content.trim(),
    });
    setEditing(false);
  }

  return (
    <article className="post output-card">
      {editing ? (
        <div className="post-edit">
          <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="성과 제목" />
          <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="성과 내용" />
          <div className="button-row">
            <button className="primary" type="button" onClick={save}><Save size={15} /> 저장</button>
            <button type="button" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <>
          <strong>{output.title}</strong>
          {output.content && <p>{output.content}</p>}
          {output.fileUrl && (
            isImage ? (
              <img className="output-image" src={output.fileUrl} alt={output.fileName || output.title} />
            ) : (
              <a className="file-link" href={output.fileUrl} download={output.fileName || "output-file"}>
                <Download size={16} /> {output.fileName || "첨부파일"}
              </a>
            )
          )}
          <footer>
            <span>{output.authorName} · 작성 {formatDate(output.createdAt)}{output.editedAt && ` · 수정 ${formatDateTime(output.editedAt)}`}</span>
            {canManage && (
              <span className="post-actions">
                <button type="button" onClick={() => { setDraft({ title: output.title || "", content: output.content || "" }); setEditing(true); }}><Pencil size={15} /> 수정</button>
                <button type="button" onClick={() => deleteOutput(output)}><Trash2 size={15} /> 삭제</button>
              </span>
            )}
          </footer>
        </>
      )}
    </article>
  );
}

function SchedulePanel({ title, collection, kind, items, isAdmin, addSchedule, deleteSchedule }) {
  const [form, setForm] = useState({ title: "", date: new Date().toISOString().slice(0, 10), description: "" });
  return (
    <section className="panel">
      <h2><CalendarDays size={19} /> {title}</h2>
      {isAdmin && (
        <form className="inline-form" onSubmit={(event) => { event.preventDefault(); addSchedule(collection, { ...form, kind }); setForm({ ...form, title: "", description: "" }); }}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder={`${title} 제목`} />
          <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="메모" />
          <button className="primary" type="submit"><Plus size={17} /> 추가</button>
        </form>
      )}
      <div className="cards">
        {items.length === 0 ? <p className="empty">등록된 항목이 없습니다.</p> : items.map((item) => (
          <article className="post" key={item.id}>
            <strong>{item.title}</strong>
            <p>{formatDate(item.date)} {item.description && `· ${item.description}`}</p>
            {isAdmin && <footer><span /> <button type="button" onClick={() => deleteSchedule(collection, item)}><Trash2 size={15} /> 삭제</button></footer>}
          </article>
        ))}
      </div>
    </section>
  );
}

function AttendancePanel({ data, members, user, isAdmin, clubId, markAttendance }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const statuses = [["present", "출석"], ["late", "지각"], ["absent", "결석"]];
  if (!isAdmin) {
    const records = data.attendance.filter((item) => item.clubId === clubId && item.memberId === user.id);
    const present = records.filter((item) => item.status === "present").length;
    const rate = records.length ? Math.round((present / records.length) * 100) : 0;
    return (
      <section className="panel">
        <h2><CheckCircle2 size={19} /> 내 출석 현황</h2>
        <div className="metrics">
          <Metric label="출석률" value={`${rate}%`} />
          <Metric label="출석" value={`${present}회`} />
          <Metric label="기록" value={`${records.length}회`} />
        </div>
      </section>
    );
  }
  return (
    <section className="panel">
      <h2><CheckCircle2 size={19} /> 출석 관리</h2>
      <label className="date-field">날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <div className="cards">
        {members.map((member) => {
          const key = `${clubId}_${member.id}_${date}`;
          const selected = data.attendance.find((item) => item.key === key)?.status;
          return (
            <article className="attendance-row" key={member.id}>
              <strong>{memberLabel(member)} {psMark(member.status)}</strong>
              <div className="button-row">
                {statuses.map(([status, label]) => (
                  <button className={selected === status ? "active" : ""} key={status} type="button" onClick={() => markAttendance(member.id, date, status)}>{label}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ProfilePage({ data, user, saveProfile, changePassword, submitPwRequest }) {
  const [editing, setEditing] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [requestingPw, setRequestingPw] = useState(false);
  const myRequests = data.pwRequests.filter((req) => req.memberId === user.id);

  return (
    <div className="stack">
      <section className="profile">
        <div className="avatar">{user.name?.slice(0, 1)}</div>
        <div>
          <h1>{memberLabel(user)} {psMark(user.status)}</h1>
          <p>{genderLabel(user.gender)} · {statusLabel(user.status)}</p>
          <div className="badges">{(user.clubs || []).map((clubId) => <ClubBadge key={clubId} clubId={clubId} />)}</div>
        </div>
      </section>
      <section className="panel">
        <h2><User size={19} /> 내 정보</h2>
        <div className="info-grid">
          <Info label="이름" value={user.name} />
          <Info label="학번" value={`${user.studentYear}학번`} />
          <Info label="성별" value={genderLabel(user.gender)} />
          <Info label="재적 상태" value={statusLabel(user.status)} />
          <Info label="최종 수정" value={formatDate(user.updatedAt)} />
        </div>
        <div className="actions">
          <button type="button" onClick={() => setRequestingPw(!requestingPw)}><KeyRound size={16} /> 비밀번호 찾기 요청</button>
          <button type="button" onClick={() => setChangingPw(!changingPw)}><KeyRound size={16} /> 비밀번호 변경</button>
          <button className="primary" type="button" onClick={() => setEditing(!editing)}><Pencil size={16} /> 정보 수정</button>
        </div>
      </section>
      {editing && <ProfileEditor user={user} saveProfile={saveProfile} done={() => setEditing(false)} />}
      {changingPw && <PasswordEditor changePassword={changePassword} done={() => setChangingPw(false)} />}
      {requestingPw && <PwRequestPanel requests={myRequests} submitPwRequest={submitPwRequest} />}
    </div>
  );
}

function MessagesPage({ messages, sentMessages, messageReads, user, sendAdminMessage, markMessagesRead }) {
  const [form, setForm] = useState({ title: "", content: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    markMessagesRead(messages).catch(console.warn);
  }, [messages, markMessagesRead]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await sendAdminMessage(form);
      setForm({ title: "", content: "" });
    } catch (err) {
      setError(err.message || "쪽지를 보내지 못했습니다.");
    }
  }

  return (
    <div className="stack">
      <section className="panel">
        <h2><Send size={19} /> 관리자에게 쪽지 보내기</h2>
        {error && <div className="alert error">{error}</div>}
        <form className="form" onSubmit={submit}>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="쪽지 제목" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="관리자에게 보낼 내용" />
          <button className="primary" type="submit"><Send size={17} /> 보내기</button>
        </form>
      </section>
      <section className="panel">
        <h2><Mail size={19} /> 받은 쪽지함</h2>
        <div className="cards">
          {messages.length === 0 ? (
            <p className="empty">받은 쪽지가 없습니다.</p>
          ) : messages.map((message) => {
            const unread = !isMessageRead(messageReads || [], user?.id, message.id);
            return (
            <article className={unread ? "post unread-message" : "post"} key={message.id}>
              <div className="post-head">
                <span className="global-badge">{message.scope === "all" ? "전체" : "개별"}</span>
                {unread && <span className="secret-badge">새 쪽지</span>}
                <strong>{message.title}</strong>
              </div>
              <p>{message.content}</p>
              <footer><span>{message.senderName} · {formatDateTime(message.createdAt)}</span></footer>
            </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2><Mail size={19} /> 관리자에게 보낸 쪽지</h2>
        <div className="cards">
          {sentMessages.length === 0 ? (
            <p className="empty">관리자에게 보낸 쪽지가 없습니다.</p>
          ) : sentMessages.map((message) => (
            <article className="post" key={message.id}>
              <div className="post-head">
                <span className="global-badge">관리자</span>
                <strong>{message.title}</strong>
              </div>
              <p>{message.content}</p>
              <footer><span>{formatDateTime(message.createdAt)}</span></footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProfileEditor({ user, saveProfile, done }) {
  const [form, setForm] = useState({
    name: user.name || "",
    studentYear: user.studentYear || "",
    gender: user.gender || "female",
    status: user.status || "active",
    clubs: [...(user.clubs || [])],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleClub(clubId) {
    setForm((current) => ({
      ...current,
      clubs: current.clubs.includes(clubId)
        ? current.clubs.filter((id) => id !== clubId)
        : [...current.clubs, clubId],
    }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveProfile(form);
      done();
    } catch (err) {
      setError(err.message || "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel accent">
      <h2><Pencil size={19} /> 내 정보 수정</h2>
      {error && <div className="alert error">{error}</div>}
      <form className="form" onSubmit={submit}>
        <label>이름<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <div className="two">
          <label>
            학번
            <select value={form.studentYear} onChange={(event) => setForm({ ...form, studentYear: event.target.value })}>
              {YEARS.map((year) => <option key={year} value={year}>{year}학번</option>)}
            </select>
          </label>
          <label>
            성별
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타</option>
            </select>
          </label>
        </div>
        <label>
          재적 상태
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
            <option value="active">현역 PS1</option>
            <option value="graduated">졸업생 PS0</option>
          </select>
        </label>
        <ClubPicker selected={form.clubs} toggle={toggleClub} imageMode />
        <div className="actions">
          <button type="button" onClick={done}>취소</button>
          <button className="primary" disabled={saving} type="submit"><Save size={16} /> 저장하기</button>
        </div>
      </form>
    </section>
  );
}

function PasswordEditor({ changePassword, done }) {
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await changePassword(form);
      done();
    } catch (err) {
      setError(err.message || "변경에 실패했습니다.");
    }
  }
  return (
    <section className="panel accent">
      <h2><KeyRound size={19} /> 비밀번호 변경</h2>
      {error && <div className="alert error">{error}</div>}
      <form className="form" onSubmit={submit}>
        <PasswordInput maxLength={8} placeholder="현재 비밀번호 8자리" value={form.oldPassword} onChange={(value) => setForm({ ...form, oldPassword: value.replace(/\D/g, "") })} />
        <div className="two">
          <PasswordInput maxLength={8} placeholder="새 비밀번호 8자리" value={form.newPassword} onChange={(value) => setForm({ ...form, newPassword: value.replace(/\D/g, "") })} />
          <PasswordInput maxLength={8} placeholder="새 비밀번호 확인" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value.replace(/\D/g, "") })} />
        </div>
        <div className="actions">
          <button type="button" onClick={done}>취소</button>
          <button className="primary" type="submit">변경하기</button>
        </div>
      </form>
    </section>
  );
}

function PwRequestPanel({ requests, submitPwRequest }) {
  const [msg, setMsg] = useState("");
  return (
    <section className="panel accent">
      <h2><KeyRound size={19} /> 비밀번호 찾기 요청</h2>
      <form className="form" onSubmit={(event) => { event.preventDefault(); submitPwRequest(msg); setMsg(""); }}>
        <textarea value={msg} onChange={(event) => setMsg(event.target.value)} placeholder="관리자에게 전달할 메시지" />
        <button className="primary" type="submit">요청 보내기</button>
      </form>
      <div className="cards">
        {requests.map((req) => (
          <article className="post" key={req.id}>
            <strong>{req.status === "pending" ? "처리 대기 중" : "답변 완료"}</strong>
            {req.adminReply && <p>{req.adminReply}</p>}
            <small>{formatDate(req.createdAt)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminPage({ data, stats, tab, setTab, deleteRecord, addResource, replyPwRequest, approveSignupRequest, rejectSignupRequest, restoreSignupRequest, updateRecord, sendMessage, forceWithdraw, refresh }) {
  const pendingPwCount = data.pwRequests.filter((req) => req.status === "pending").length;
  const pendingSignupCount = data.signupRequests.filter((req) => req.approvalStatus === "pending").length;
  return (
    <div className="stack">
      <section className="toolbar">
        <h1>관리자 패널</h1>
        <button type="button" onClick={refresh}><RefreshCw size={16} /> 새로고침</button>
      </section>
      <div className="tabs">
        <button className={tab === "members" ? "active" : ""} type="button" onClick={() => setTab("members")}>회원</button>
        <button className={tab === "signup" ? "active" : ""} type="button" onClick={() => setTab("signup")}>가입신청 {pendingSignupCount || ""}</button>
        <button className={tab === "pw" ? "active" : ""} type="button" onClick={() => setTab("pw")}>비번요청 {pendingPwCount || ""}</button>
        <button className={tab === "messages" ? "active" : ""} type="button" onClick={() => setTab("messages")}>쪽지</button>
        <button className={tab === "resources" ? "active" : ""} type="button" onClick={() => setTab("resources")}>자료</button>
        <button className={tab === "posts" ? "active" : ""} type="button" onClick={() => setTab("posts")}>게시판</button>
        <button className={tab === "stats" ? "active" : ""} type="button" onClick={() => setTab("stats")}>통계</button>
        <button className={tab === "withdrawals" ? "active" : ""} type="button" onClick={() => setTab("withdrawals")}>탈퇴이력</button>
      </div>
      {tab === "members" && <AdminMembers members={data.members} forceWithdraw={forceWithdraw} />}
      {tab === "signup" && <AdminSignupRequests requests={data.signupRequests} approveSignupRequest={approveSignupRequest} rejectSignupRequest={rejectSignupRequest} restoreSignupRequest={restoreSignupRequest} />}
      {tab === "pw" && <AdminPwRequests requests={data.pwRequests} members={data.members} replyPwRequest={replyPwRequest} />}
      {tab === "messages" && <AdminMessages members={data.members} messages={data.messages} sendMessage={sendMessage} deleteMessage={(item) => deleteRecord("messages", item)} />}
      {tab === "resources" && <AdminResources resources={data.resources} addResource={addResource} deleteResource={(item) => deleteRecord("resources", item)} />}
      {tab === "posts" && (
        <>
          <section className="panel">
            <h2>게시글 관리</h2>
            <PostList posts={data.posts} isAdmin deletePost={(post) => deleteRecord("posts", post)} updatePost={(post, changes) => updateRecord("posts", post, changes)} />
          </section>
          <section className="panel">
            <h2>홍보글 관리</h2>
            <PostList posts={data.promos} isAdmin deletePost={(post) => deleteRecord("promos", post)} updatePost={(post, changes) => updateRecord("promos", post, changes)} isPromo />
          </section>
        </>
      )}
      {tab === "stats" && <CompareStats stats={stats} />}
      {tab === "withdrawals" && <Withdrawals items={data.withdrawals} />}
    </div>
  );
}

function AdminMembers({ members, forceWithdraw }) {
  return (
    <section className="panel">
      <h2><Users size={19} /> 회원 관리</h2>
      <div className="cards">
        {members.map((member) => <ForceWithdrawRow key={member.id} member={member} forceWithdraw={forceWithdraw} />)}
      </div>
    </section>
  );
}

function AdminSignupRequests({ requests, approveSignupRequest, rejectSignupRequest, restoreSignupRequest }) {
  const sorted = [...requests].sort((a, b) => {
    if (a.approvalStatus === "pending" && b.approvalStatus !== "pending") return -1;
    if (a.approvalStatus !== "pending" && b.approvalStatus === "pending") return 1;
    return recordTime(b) - recordTime(a);
  });
  if (sorted.length === 0) {
    return <section className="panel"><p className="empty">가입 신청이 없습니다.</p></section>;
  }
  return (
    <section className="panel">
      <h2><ShieldCheck size={19} /> 가입 신청 관리</h2>
      <div className="cards">
        {sorted.map((request) => (
          <SignupRequestRow
            key={request.id}
            request={request}
            approveSignupRequest={approveSignupRequest}
            rejectSignupRequest={rejectSignupRequest}
            restoreSignupRequest={restoreSignupRequest}
          />
        ))}
      </div>
    </section>
  );
}

function SignupRequestRow({ request, approveSignupRequest, rejectSignupRequest, restoreSignupRequest }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const pending = request.approvalStatus === "pending";
  const rejected = request.approvalStatus === "rejected";
  const statusText =
    request.approvalStatus === "approved"
      ? "승인 완료"
      : request.approvalStatus === "rejected"
        ? "거부 완료"
        : "승인 대기";

  return (
    <article className="admin-row signup-row">
      <div>
        <strong>{memberLabel(request)} {psMark(request.status)}</strong>
        <p>{genderLabel(request.gender)} · {statusLabel(request.status)} · 신청일 {formatDateTime(request.requestedAt || request.createdAt)}</p>
        <div className="badges">{(request.clubs || []).map((clubId) => <ClubBadge key={clubId} clubId={clubId} />)}</div>
        <small>상태: {statusText}{request.rejectReason ? ` · 사유: ${request.rejectReason}` : ""}</small>
      </div>
      {pending ? (
        <>
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="거부 사유(선택)" />
          <div className="button-row">
            <button
              className="primary"
              type="button"
              onClick={async () => {
                setError("");
                try {
                  await approveSignupRequest(request);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              승인
            </button>
            <button
              type="button"
              onClick={async () => {
                setError("");
                try {
                  await rejectSignupRequest(request, reason);
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              거부
            </button>
          </div>
        </>
      ) : rejected ? (
        <div className="button-row">
          <button
            type="button"
            onClick={async () => {
              setError("");
              try {
                await restoreSignupRequest(request);
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            거부 취소
          </button>
          <button
            className="primary"
            type="button"
            onClick={async () => {
              setError("");
              try {
                await approveSignupRequest(request);
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            승인
          </button>
        </div>
      ) : (
        <small>{request.reviewedAt ? `${formatDateTime(request.reviewedAt)} 처리` : ""}</small>
      )}
      {error && <small className="danger">{error}</small>}
    </article>
  );
}

function ForceWithdrawRow({ member, forceWithdraw }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  return (
    <article className="admin-row">
      <div>
        <strong>{memberLabel(member)} {psMark(member.status)}</strong>
        <div className="badges">{(member.clubs || []).map((clubId) => <ClubBadge key={clubId} clubId={clubId} />)}</div>
      </div>
      <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="탈퇴 사유" />
      <button
        type="button"
        onClick={async () => {
          setError("");
          try {
            await forceWithdraw(member, reason);
          } catch (err) {
            setError(err.message);
          }
        }}
      >
        강제 탈퇴
      </button>
      {error && <small className="danger">{error}</small>}
    </article>
  );
}

function AdminPwRequests({ requests, members, replyPwRequest }) {
  if (requests.length === 0) return <section className="panel"><p className="empty">비밀번호 요청이 없습니다.</p></section>;
  return (
    <section className="panel">
      <h2><KeyRound size={19} /> 비밀번호 요청</h2>
      <div className="cards">
        {requests.map((req) => {
          const member = members.find((m) => m.id === req.memberId);
          return <PwReplyRow key={req.id} req={req} member={member} replyPwRequest={replyPwRequest} />;
        })}
      </div>
    </section>
  );
}

function PwReplyRow({ req, member, replyPwRequest }) {
  const [reply, setReply] = useState(member?.password ? `현재 비밀번호는 ${member.password} 입니다.` : "");
  return (
    <article className="post">
      <strong>{req.memberName} ({req.studentYear}) · {req.status === "pending" ? "대기" : "완료"}</strong>
      {req.message && <p>요청 메시지: {req.message}</p>}
      <p>실제 비밀번호: <strong>{member?.password || "탈퇴/미확인 회원"}</strong></p>
      {req.status === "pending" ? (
        <div className="inline-form">
          <input value={reply} onChange={(event) => setReply(event.target.value)} placeholder="학생에게 전달할 답변" />
          <button className="primary" type="button" onClick={() => replyPwRequest(req, reply)}>답변 보내기</button>
        </div>
      ) : (
        <p>답변: {req.adminReply}</p>
      )}
    </article>
  );
}

function AdminMessages({ members, messages = [], sendMessage, deleteMessage }) {
  const [form, setForm] = useState({ recipientId: "all", title: "", content: "" });
  const [error, setError] = useState("");
  const incoming = messages.filter((message) => message.recipientId === "admin").sort(sortNewest);
  const sent = messages.filter((message) => message.senderId === "admin").sort(sortNewest);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await sendMessage(form);
      setForm({ recipientId: "all", title: "", content: "" });
    } catch (err) {
      setError(err.message || "쪽지 발송에 실패했습니다.");
    }
  }

  return (
    <section className="panel">
      <h2><Mail size={19} /> 쪽지 보내기</h2>
      {error && <div className="alert error">{error}</div>}
      <form className="form" onSubmit={submit}>
        <div className="two">
          <select value={form.recipientId} onChange={(event) => setForm({ ...form, recipientId: event.target.value })}>
            <option value="all">전체 회원</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{memberLabel(member)}</option>
            ))}
          </select>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="쪽지 제목" />
        </div>
        <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="쪽지 내용" />
        <button className="primary" type="submit"><Send size={17} /> 보내기</button>
      </form>
      <section className="message-section">
        <h3>학생이 보낸 쪽지</h3>
        <div className="cards">
          {incoming.length === 0 ? (
            <p className="empty">학생이 보낸 쪽지가 없습니다.</p>
          ) : incoming.map((message) => (
            <article className="post" key={message.id}>
              <div className="post-head">
                <span className="global-badge">학생</span>
                <strong>{message.title}</strong>
              </div>
              <p>{message.content}</p>
              <footer>
                <span>{message.senderName} · {formatDateTime(message.createdAt)}</span>
                <button type="button" onClick={() => deleteMessage(message)}><Trash2 size={15} /> 삭제</button>
              </footer>
            </article>
          ))}
        </div>
      </section>
      <div className="cards message-history">
        <h3>관리자가 보낸 쪽지</h3>
        {sent.length === 0 ? (
          <p className="empty">보낸 쪽지가 없습니다.</p>
        ) : sent.map((message) => (
          <article className="post" key={message.id}>
            <div className="post-head">
              <span className="global-badge">{message.scope === "all" ? "전체" : "개별"}</span>
              <strong>{message.title}</strong>
            </div>
            <p>{message.content}</p>
            <footer>
              <span>{message.recipientName} · {formatDateTime(message.createdAt)}</span>
              <button type="button" onClick={() => deleteMessage(message)}><Trash2 size={15} /> 삭제</button>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function AdminResources({ resources, addResource, deleteResource }) {
  const [form, setForm] = useState({ clubId: "hora", type: "문서", title: "", note: "", imageUrl: "" });
  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = await readFileAsDataUrl(file);
    setForm((current) => ({ ...current, type: "사진", imageUrl }));
  }
  return (
    <section className="panel">
      <h2><ImageIcon size={19} /> 자료 관리</h2>
      <form className="form" onSubmit={(event) => { event.preventDefault(); addResource(form); setForm({ ...form, title: "", note: "", imageUrl: "" }); }}>
        <div className="two">
          <select value={form.clubId} onChange={(event) => setForm({ ...form, clubId: event.target.value })}>
            {CLUB_LIST.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
          </select>
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
            <option>문서</option>
            <option>사진</option>
            <option>링크</option>
            <option>기타</option>
          </select>
        </div>
        <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="자료 제목" />
        <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="메모 또는 링크" />
        <input type="file" accept="image/*" onChange={onFile} />
        <button className="primary" type="submit"><Plus size={17} /> 자료 넣기</button>
      </form>
      <div className="resource-grid">
        {resources.map((item) => (
          <article className="resource-card" key={item.id}>
            {item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : <div className="resource-placeholder">{item.type}</div>}
            <ClubBadge clubId={item.clubId} />
            <strong>{item.title}</strong>
            <p>{item.note}</p>
            <button type="button" onClick={() => deleteResource(item)}><Trash2 size={15} /> 지우기</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function Withdrawals({ items }) {
  return (
    <section className="panel">
      <h2>강제 탈퇴 이력</h2>
      <div className="cards">
        {items.length === 0 ? <p className="empty">탈퇴 이력이 없습니다.</p> : items.map((item) => (
          <article className="post" key={item.id}>
            <strong>{item.memberName} ({String(item.studentYear).slice(2)})</strong>
            <p>사유: {item.reason}</p>
            <small>{formatDate(item.withdrawnAt)}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClubImageGrid({ onClick, counts = [], selectedId = "", compact = false }) {
  return (
    <div className={compact ? "club-grid compact" : "club-grid"}>
      {CLUB_LIST.map((club) => (
        <button
          key={club.id}
          type="button"
          className={selectedId === club.id ? "club-image-card selected" : "club-image-card"}
          style={{ "--club": club.color, "--club-bg": club.bg }}
          onClick={() => onClick?.(club.id)}
        >
          <img src={club.image} alt={club.name} />
          <strong>{club.name}</strong>
          <span>{club.english}{Array.isArray(counts) && counts.length ? ` · ${counts.filter((m) => m.clubs?.includes(club.id)).length}명` : ""}</span>
        </button>
      ))}
    </div>
  );
}

function ClubPicker({ selected, toggle, imageMode = false }) {
  if (imageMode) {
    return (
      <div className="club-picker">
        <span>소속 동아리</span>
        <div className="club-grid compact">
          {CLUB_LIST.map((club) => (
            <button
              key={club.id}
              type="button"
              className={selected.includes(club.id) ? "club-image-card selected" : "club-image-card"}
              style={{ "--club": club.color, "--club-bg": club.bg }}
              onClick={() => toggle(club.id)}
            >
              <img src={club.image} alt={club.name} />
              <strong>{club.name}</strong>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="club-picker">
      <span>소속 동아리</span>
      <div>
        {CLUB_LIST.map((club) => (
          <button
            key={club.id}
            type="button"
            className={selected.includes(club.id) ? "selected" : ""}
            style={{ "--club": club.color, "--club-bg": club.bg }}
            onClick={() => toggle(club.id)}
          >
            {club.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function PostList({ posts, isAdmin, currentUser, deletePost, updatePost, isPromo = false }) {
  if (posts.length === 0) return <p className="empty">등록된 글이 없습니다.</p>;
  return (
    <div className="cards">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isAdmin={isAdmin}
          currentUser={currentUser}
          deletePost={deletePost}
          updatePost={updatePost}
          isPromo={isPromo}
        />
      ))}
    </div>
  );
}

function PostCard({ post, isAdmin, currentUser, deletePost, updatePost, isPromo }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: post.title || "",
    content: post.content || "",
  });
  const canManage = isAdmin || currentUser?.id === post.authorId;

  async function saveEdit() {
    if (!draft.content.trim()) return;
    const changes = isPromo
      ? { title: draft.title.trim(), content: draft.content.trim() }
      : { content: draft.content.trim() };
    await updatePost?.(post, changes);
    setEditing(false);
  }

  return (
    <article className="post">
      <div className="post-head">
        <ClubBadge clubId={post.clubId} />
        {post.isGlobal && <span className="global-badge">전체공지</span>}
        {post.isAnon && <span className="secret-badge">익명</span>}
      </div>
      {editing ? (
        <div className="post-edit">
          {isPromo && (
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="제목"
            />
          )}
          <textarea
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            placeholder="내용"
          />
          <div className="button-row">
            <button className="primary" type="button" onClick={saveEdit}><Save size={15} /> 저장</button>
            <button type="button" onClick={() => setEditing(false)}>취소</button>
          </div>
        </div>
      ) : (
        <>
          {isPromo && <h3>{post.title}</h3>}
          <p>{post.content}</p>
        </>
      )}
      <footer>
        <span>
          {post.authorName} · 작성 {formatDate(post.createdAt)}
          {post.editedAt && ` · 수정 ${formatDateTime(post.editedAt)}`}
        </span>
        {canManage && !editing && (
          <span className="post-actions">
            {updatePost && (
              <button
                type="button"
                onClick={() => {
                  setDraft({ title: post.title || "", content: post.content || "" });
                  setEditing(true);
                }}
              >
                <Pencil size={15} /> 수정
              </button>
            )}
            {deletePost && <button type="button" onClick={() => deletePost(post)}><Trash2 size={15} /> 삭제</button>}
          </span>
        )}
      </footer>
    </article>
  );
}

function MemberTable({ members }) {
  if (members.length === 0) return <p className="empty">회원이 없습니다.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>이름</th>
            <th>학번</th>
            <th>성별</th>
            <th>상태</th>
            <th>동아리</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td><strong>{memberLabel(member)}</strong> {psMark(member.status)}</td>
              <td>{member.studentYear}</td>
              <td>{genderLabel(member.gender)}</td>
              <td>{statusLabel(member.status)}</td>
              <td><div className="badges">{(member.clubs || []).map((clubId) => <ClubBadge key={clubId} clubId={clubId} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NavButton({ id, page, setPage, icon: Icon, label, highlight = false }) {
  return (
    <button className={[page === id ? "active" : "", highlight ? "has-unread" : ""].filter(Boolean).join(" ")} type="button" onClick={() => setPage(id)}>
      <Icon size={17} />
      {label}
    </button>
  );
}

function Metric({ label, value }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ClubBadge({ clubId }) {
  const club = CLUBS[clubId] || { name: clubId, color: "#777", bg: "#eee" };
  return <span className="badge" style={{ "--club": club.color, "--club-bg": club.bg }}>{club.name}</span>;
}

function Bar({ label, value, max, color, suffix }) {
  const width = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-row">
      <div><span>{label}</span><strong>{value}{suffix}</strong></div>
      <div className="bar"><span style={{ width: `${width}%`, background: color }} /></div>
    </div>
  );
}

async function fetchRemoteData() {
  const [members, posts, promos, schedules, events, attendance, outputs, resources, messages, messageReads, pwRequests, signupRequests, withdrawals] = await Promise.all([
    fbGet("members"),
    fbGet("posts"),
    fbGet("promos"),
    fbGet("schedules"),
    fbGet("events"),
    fbGet("attendance"),
    fbGet("outputs"),
    fbGet("resources"),
    fbGet("messages"),
    fbGet("messageReads"),
    fbGet("pwRequests"),
    fbGet("signupRequests"),
    fbGet("withdrawals"),
  ]);

  return {
    members: normalizeMembers(toArray(members)),
    posts: toArray(posts).sort(sortNewest),
    promos: toArray(promos).sort(sortNewest),
    schedules: toArray(schedules).sort(sortNewest),
    events: toArray(events).sort(sortNewest),
    attendance: toArray(attendance, "key"),
    outputs: toArray(outputs).sort(sortNewest),
    resources: toArray(resources).sort(sortNewest),
    messages: toArray(messages).sort(sortNewest),
    messageReads: toArray(messageReads, "key"),
    pwRequests: toArray(pwRequests).sort(sortNewest),
    signupRequests: toArray(signupRequests).sort(sortNewest),
    withdrawals: toArray(withdrawals).sort(sortNewest),
  };
}

function reconcileSession(remote, currentUser, currentIsAdmin) {
  if (!currentUser || currentIsAdmin || currentUser.id === "admin") {
    return { data: remote, user: currentUser, repairMember: null };
  }
  const remoteMember = remote.members.find((member) => member.id === currentUser.id);
  if (!remoteMember) return { data: remote, user: null, repairMember: null };

  if (recordTime(remoteMember) >= recordTime(currentUser)) {
    return { data: remote, user: remoteMember, repairMember: null };
  }

  return {
    data: { ...remote, members: upsertById(remote.members, currentUser) },
    user: currentUser,
    repairMember: currentUser,
  };
}

function normalizeMembers(members) {
  const byId = new Map();
  for (const member of members) {
    if (!member?.id) continue;
    const current = byId.get(member.id);
    if (!current || isNewerMember(member, current)) byId.set(member.id, member);
  }
  return Array.from(byId.values()).sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "ko"),
  );
}

function pickLatestMember(members) {
  return members.reduce((latest, member) => {
    if (!latest) return member;
    return isNewerMember(member, latest) ? member : latest;
  }, null);
}

function pickLatestRequest(requests) {
  return requests.reduce((latest, request) => {
    if (!latest) return request;
    return recordTime(request) > recordTime(latest) ? request : latest;
  }, null);
}

function isNewerMember(candidate, current) {
  const candidateTime = recordTime(candidate);
  const currentTime = recordTime(current);
  if (candidateTime !== currentTime) return candidateTime > currentTime;
  const candidateKeyMatchesId = candidate._fbKey === candidate.id;
  const currentKeyMatchesId = current._fbKey === current.id;
  if (candidateKeyMatchesId !== currentKeyMatchesId) return candidateKeyMatchesId;
  return String(candidate._fbKey || "") > String(current._fbKey || "");
}

async function persistMember(member) {
  await fbPut(`members/${firebaseRecordKey(member, member.id)}`, cleanFirebase(member));
}

async function fbGet(path) {
  const response = await fetch(`${DB}/${path}.json`);
  if (!response.ok) throw new Error(`GET ${path} failed`);
  const data = await response.json();
  return data === null ? undefined : data;
}

async function fbPut(path, value) {
  const response = await fetch(`${DB}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`PUT ${path} failed`);
}

async function fbPatch(path, value) {
  const response = await fetch(`${DB}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`PATCH ${path} failed`);
}

async function fbDelete(path) {
  const response = await fetch(`${DB}/${path}.json`, { method: "DELETE" });
  if (!response.ok) throw new Error(`DELETE ${path} failed`);
}

function readLocalData() {
  return {
    ...EMPTY_DATA,
    members: readStorage(STORAGE.members, []),
    posts: readStorage(STORAGE.posts, []),
    promos: readStorage(STORAGE.promos, []),
    schedules: readStorage(STORAGE.schedules, []),
    events: readStorage(STORAGE.events, []),
    attendance: readStorage(STORAGE.attendance, []),
    outputs: [],
    resources: [],
    messages: readStorage(STORAGE.messages, []),
    messageReads: readStorage(STORAGE.messageReads, []),
    pwRequests: readStorage(STORAGE.pwRequests, []),
    signupRequests: readStorage(STORAGE.signupRequests, []),
    withdrawals: readStorage(STORAGE.withdrawals, []),
  };
}

function saveLocalData(data) {
  writeStorage(STORAGE.members, data.members);
  writeStorage(STORAGE.posts, data.posts);
  writeStorage(STORAGE.promos, data.promos);
  writeStorage(STORAGE.schedules, data.schedules);
  writeStorage(STORAGE.events, data.events);
  writeStorage(STORAGE.attendance, data.attendance);
  writeStorage(STORAGE.outputs, null);
  writeStorage(STORAGE.resources, null);
  writeStorage(STORAGE.messages, data.messages);
  writeStorage(STORAGE.messageReads, data.messageReads);
  writeStorage(STORAGE.pwRequests, data.pwRequests);
  writeStorage(STORAGE.signupRequests, data.signupRequests);
  writeStorage(STORAGE.withdrawals, data.withdrawals);
}

function readStorage(key, fallback) {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`localStorage 저장을 건너뜁니다: ${key}`, err);
    try {
      window.localStorage.removeItem(key);
    } catch {
      // localStorage cleanup best effort only.
    }
  }
}

function toArray(value, idField = "id") {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return Object.entries(value)
    .filter(([, item]) => item && typeof item === "object")
    .map(([key, item]) => ({ ...item, [idField]: item[idField] || key, _fbKey: key }));
}

function cleanFirebase(value) {
  if (Array.isArray(value)) return value.map(cleanFirebase);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "_fbKey")
      .map(([key, entry]) => [key, cleanFirebase(entry)]),
  );
}

function upsertById(items, item) {
  const exists = items.some((entry) => entry.id === item.id);
  return exists ? items.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...items];
}

function upsertByKey(items, item, keyField) {
  const exists = items.some((entry) => entry[keyField] === item[keyField]);
  return exists ? items.map((entry) => (entry[keyField] === item[keyField] ? item : entry)) : [item, ...items];
}

function getVisibleMessages(messages, user, isAdmin) {
  if (!user || isAdmin) return [];
  return messages
    .filter((item) => item.recipientId === "all" || item.recipientId === user.id)
    .sort(sortNewest);
}

function isMessageRead(reads, memberId, messageId) {
  if (!memberId || !messageId) return true;
  const key = `${memberId}_${messageId}`;
  return reads.some((item) => item.key === key || (item.memberId === memberId && item.messageId === messageId));
}

function firebaseKey(value) {
  return String(value).replace(/[.$#[\]/]/g, "_");
}

function firebaseRecordKey(record, fallback) {
  return firebaseKey(record?._fbKey || record?.id || record?.key || fallback);
}

function buildStats(data) {
  const outputs = data.outputs || [];
  return CLUB_LIST.map((club) => {
    const members = data.members.filter((member) => member.clubs?.includes(club.id));
    const attendance = data.attendance.filter((item) => item.clubId === club.id);
    const present = attendance.filter((item) => item.status === "present").length;
    return {
      club,
      members: members.length,
      active: members.filter((member) => member.status !== "graduated").length,
      graduated: members.filter((member) => member.status === "graduated").length,
      posts: data.posts.filter((post) => post.clubId === club.id).length,
      promos: data.promos.filter((promo) => promo.clubId === club.id).length,
      outputs: outputs.filter((item) => item.clubId === club.id).length,
      resources: data.resources.filter((item) => item.clubId === club.id).length,
      attendanceRate: attendance.length ? Math.round((present / attendance.length) * 100) : 0,
    };
  });
}

function formatRanking(stats, key, suffix) {
  const sorted = [...stats].sort((a, b) => {
    if (b[key] !== a[key]) return b[key] - a[key];
    return a.club.name.localeCompare(b.club.name, "ko");
  });
  const groups = [];
  for (const stat of sorted) {
    const last = groups[groups.length - 1];
    const item = `${stat.club.name}(${stat[key]}${suffix})`;
    if (last && last.value === stat[key]) {
      last.items.push(item);
    } else {
      groups.push({ value: stat[key], items: [item] });
    }
  }
  return groups.map((group) => group.items.join(" = ")).join(" > ");
}

function memberLabel(member) {
  return `${member.name}(${String(member.studentYear || "").slice(2)})`;
}

function psMark(status) {
  const graduated = status === "graduated";
  return <span className={graduated ? "ps-mark ps0" : "ps-mark ps1"}>{graduated ? "PS0" : "PS1"}</span>;
}

function statusLabel(status) {
  return status === "graduated" ? "졸업생" : "현역";
}

function genderLabel(value) {
  if (value === "male") return "남성";
  if (value === "female") return "여성";
  return "기타";
}

function recordTime(record) {
  return (
    Date.parse(record?.updatedAt || "") ||
    Date.parse(record?.editedAt || "") ||
    Date.parse(record?.reviewedAt || "") ||
    Date.parse(record?.requestedAt || "") ||
    Date.parse(record?.createdAt || "") ||
    Date.parse(record?.repliedAt || "") ||
    Date.parse(record?.withdrawnAt || "") ||
    Date.parse(record?.joinedAt || "") ||
    Date.parse(record?.date || "") ||
    0
  );
}

function sortNewest(a, b) {
  return recordTime(b) - recordTime(a);
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function now() {
  return new Date().toISOString();
}

function todayKey() {
  return dateKey(new Date());
}

function currentMonthKey() {
  return todayKey().slice(0, 7);
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(monthKey, delta) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return dateKey(date).slice(0, 7);
}

function buildCalendarDays(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: dateKey(date),
      label: date.getDate(),
      currentMonth: date.getMonth() === month - 1,
    };
  });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isEditingField() {
  const active = document.activeElement;
  return active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
