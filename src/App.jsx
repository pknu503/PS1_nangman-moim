import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  LogOut,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
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
  schedules: "nm_schedules",
  events: "nm_events",
  attendance: "nm_attend",
  promos: "nm_promos",
  pwRequests: "nm_pwreq",
  withdrawals: "nm_withdrawals",
};

const CLUBS = {
  hora: {
    id: "hora",
    name: "오라",
    english: "Hora",
    color: "#7d65b3",
    bg: "#f1edf9",
    description: "시간을 함께하며 현장과 사람을 배우는 동아리",
    boardName: "오라타임",
  },
  myth: {
    id: "myth",
    name: "클럽신화",
    english: "MYTH",
    color: "#bd6538",
    bg: "#fff0e8",
    description: "새로운 이야기를 기획하고 기록하는 동아리",
    boardName: "신화창조",
  },
  theme: {
    id: "theme",
    name: "띰",
    english: "Theme",
    color: "#3f73bc",
    bg: "#eaf1fb",
    description: "주제를 탐구하고 발표하며 성장하는 동아리",
    boardName: "테마찾기",
  },
};

const CLUB_LIST = Object.values(CLUBS);

const EMPTY_DATA = {
  members: [],
  posts: [],
  schedules: [],
  events: [],
  attendance: [],
  promos: [],
  pwRequests: [],
  withdrawals: [],
};

function App() {
  const [data, setData] = useState(readLocalData);
  const [user, setUser] = useState(() => readStorage(STORAGE.user, null));
  const [isAdmin, setIsAdmin] = useState(() =>
    readStorage(STORAGE.admin, false),
  );
  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState(() =>
    readStorage(STORAGE.user, null) ? "home" : "auth",
  );
  const [selectedClubId, setSelectedClubId] = useState("hora");
  const [clubTab, setClubTab] = useState("board");
  const [notice, setNotice] = useState("");
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
      if (isFormFieldFocused()) return;
      refreshData({ silent: true });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [user]);

  const sessionMember = useMemo(() => {
    if (!user || isAdmin) return user;
    return data.members.find((member) => member.id === user.id) || user;
  }, [data.members, isAdmin, user]);

  const visibleClubIds = isAdmin
    ? CLUB_LIST.map((club) => club.id)
    : sessionMember?.clubs || [];

  const selectedClub = CLUBS[selectedClubId] || CLUBS.hora;

  const stats = useMemo(
    () => CLUB_LIST.map((club) => buildClubStats(club, data)),
    [data],
  );

  async function refreshData({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const remote = await fetchRemoteData();
      const { nextData, nextUser, memberToRepair } = reconcileSession(
        remote,
        userRef.current,
        adminRef.current,
      );
      setData(nextData);
      if (nextUser !== userRef.current) setUser(nextUser);
      if (memberToRepair) {
        persistMember(memberToRepair).catch((err) =>
          console.warn("member repair failed", err),
        );
      }
      return nextData;
    } catch (err) {
      setError(
        "Firebase 데이터를 불러오지 못했습니다. 잠시 뒤 다시 시도해주세요.",
      );
      console.error(err);
      return data;
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleLogin({ name, password }) {
    setError("");
    setNotice("");
    if (!name || !password) {
      setError("이름과 비밀번호를 입력해주세요.");
      return;
    }

    if (name === ADMIN_ID && password === ADMIN_PW) {
      setLoading(true);
      const remote = await fetchRemoteData().catch(() => data);
      setData(remote);
      setUser({
        id: "admin",
        name: "관리자",
        studentYear: "관리자",
        gender: "-",
        clubs: CLUB_LIST.map((club) => club.id),
      });
      setIsAdmin(true);
      setPage("home");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const remote = await fetchRemoteData();
      setData(remote);
      const member = remote.members.find(
        (item) => item.name === name && item.password === password,
      );
      if (!member) {
        setError("이름 또는 비밀번호가 일치하지 않습니다.");
        return;
      }
      setUser(member);
      setIsAdmin(false);
      setPage("home");
      setNotice(`${member.name}님, 다시 만나서 반가워요.`);
    } catch (err) {
      setError("로그인 중 Firebase 연결에 실패했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(form) {
    setError("");
    setNotice("");
    if (!form.name.trim()) return setError("이름을 입력해주세요.");
    if (!form.studentYear) return setError("학번을 선택해주세요.");
    if (!/^\d{8}$/.test(form.password)) {
      return setError("비밀번호는 숫자 8자리여야 합니다.");
    }
    if (form.password !== form.passwordConfirm) {
      return setError("비밀번호가 일치하지 않습니다.");
    }
    if (form.clubs.length === 0) {
      return setError("최소 하나의 동아리를 선택해주세요.");
    }

    setLoading(true);
    try {
      const remote = await fetchRemoteData();
      const duplicated = remote.members.some(
        (member) =>
          member.name === form.name.trim() &&
          String(member.studentYear) === String(form.studentYear),
      );
      if (duplicated) {
        setError("이미 등록된 이름+학번 조합입니다.");
        return;
      }

      const member = {
        id: makeId("member"),
        name: form.name.trim(),
        studentYear: form.studentYear,
        gender: form.gender,
        status: form.status,
        clubs: form.clubs,
        password: form.password,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await persistMember(member);
      const nextData = { ...remote, members: upsertById(remote.members, member) };
      setData(nextData);
      setUser(member);
      setIsAdmin(false);
      setPage("home");
      setNotice("가입 정보가 Firebase에 저장되었습니다.");
    } catch (err) {
      setError("가입 정보를 Firebase에 저장하지 못했습니다.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveMember(updatedMember) {
    const updated = {
      ...updatedMember,
      clubs: [...updatedMember.clubs],
      updatedAt: new Date().toISOString(),
    };

    setUser(updated);
    setData((current) => ({
      ...current,
      members: upsertById(current.members, updated),
    }));

    await persistMember(updated);
    const remoteSaved = await fbGet(`members/${firebaseRecordKey(updated, updated.id)}`);
    if (!remoteSaved) {
      throw new Error("Firebase saved member could not be verified.");
    }
    setNotice("정보가 저장되었습니다. 로그아웃 후 다시 로그인해도 이 정보가 유지됩니다.");
    return updated;
  }

  async function handleProfileSave(form) {
    if (!sessionMember) return;
    if (!form.name.trim()) throw new Error("이름을 입력해주세요.");
    if (form.clubs.length === 0) throw new Error("동아리를 선택해주세요.");

    const duplicated = data.members.some(
      (member) =>
        member.id !== sessionMember.id &&
        member.name === form.name.trim() &&
        String(member.studentYear) === String(form.studentYear),
    );
    if (duplicated) throw new Error("같은 이름+학번 조합이 이미 존재합니다.");

    return saveMember({
      ...sessionMember,
      name: form.name.trim(),
      studentYear: form.studentYear,
      gender: form.gender,
      status: form.status,
      clubs: form.clubs,
    });
  }

  async function handlePasswordChange(oldPassword, newPassword) {
    if (!sessionMember) return;
    if (oldPassword !== sessionMember.password) {
      throw new Error("현재 비밀번호가 일치하지 않습니다.");
    }
    if (!/^\d{8}$/.test(newPassword)) {
      throw new Error("새 비밀번호는 숫자 8자리여야 합니다.");
    }
    if (oldPassword === newPassword) {
      throw new Error("새 비밀번호가 기존 비밀번호와 같습니다.");
    }
    await saveMember({ ...sessionMember, password: newPassword });
  }

  function handleLogout() {
    setUser(null);
    setIsAdmin(false);
    setAuthMode("login");
    setPage("auth");
    setNotice("로그아웃되었습니다.");
  }

  async function addPromoPost(form) {
    const item = {
      id: makeId("promo"),
      clubId: form.clubId,
      title: form.title.trim(),
      content: form.content.trim(),
      authorId: user.id,
      authorName: user.name,
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      promos: [item, ...current.promos],
    }));
    await fbPatch("promos", { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function addPost(form) {
    const item = {
      id: makeId("post"),
      clubId: selectedClubId,
      authorId: user.id,
      authorName: form.anonymous ? "익명" : user.name,
      isAnon: form.anonymous,
      content: form.content.trim(),
      likes: 0,
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      posts: [item, ...current.posts],
    }));
    await fbPatch("posts", { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function addSchedule(collection, form) {
    const item = {
      id: makeId(collection),
      clubId: selectedClubId,
      title: form.title.trim(),
      date: form.date,
      type: form.type || "other",
      week: form.week || "",
      description: form.description || "",
      createdAt: new Date().toISOString(),
    };
    setData((current) => ({
      ...current,
      [collection]: [item, ...current[collection]],
    }));
    await fbPatch(collection, { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function markAttendance(memberId, date, status) {
    const key = `${selectedClubId}_${memberId}_${date}`;
    const item = { key, clubId: selectedClubId, memberId, date, status };
    setData((current) => ({
      ...current,
      attendance: upsertByKey(current.attendance, item, "key"),
    }));
    await fbPatch("attendance", { [firebaseKey(key)]: cleanFirebase(item) });
  }

  async function deleteRecord(collection, id) {
    const confirmed = window.confirm("삭제할까요?");
    if (!confirmed) return;
    const record = data[collection].find((item) => item.id === id);
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== id),
    }));
    await fbDelete(`${collection}/${firebaseRecordKey(record, id)}`);
  }

  async function deleteMember(member) {
    const confirmed = window.confirm(`${member.name} 회원을 삭제할까요?`);
    if (!confirmed) return;
    const withdrawal = {
      id: makeId("withdrawal"),
      memberId: member.id,
      memberName: member.name,
      studentYear: member.studentYear,
      gender: member.gender,
      clubs: member.clubs || [],
      status: member.status || "active",
      reason: "관리자 삭제",
      withdrawnAt: new Date().toISOString(),
      withdrawnBy: "관리자",
    };
    setData((current) => ({
      ...current,
      members: current.members.filter((item) => item.id !== member.id),
      withdrawals: [withdrawal, ...current.withdrawals],
    }));
    await fbPatch("withdrawals", {
      [firebaseKey(withdrawal.id)]: cleanFirebase(withdrawal),
    });
    await fbDelete(`members/${firebaseRecordKey(member, member.id)}`);
  }

  const navigation = [
    ["home", "홈", Home],
    ["integrated", "통합현황", BarChart3],
    ["club", "동아리", Users],
    ["profile", "내 정보", User],
  ];
  if (isAdmin) navigation.splice(3, 0, ["admin", "관리자", ShieldCheck]);

  if (!user) {
    return (
      <AuthScreen
        authMode={authMode}
        setAuthMode={setAuthMode}
        onLogin={handleLogin}
        onRegister={handleRegister}
        loading={loading}
        error={error}
        notice={notice}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setPage("home")}>
          <span className="brand-mark">낭</span>
          <span>
            <strong>낭만모임</strong>
            <small>부경대 사회복지 전공동아리</small>
          </span>
        </button>

        <nav className="main-nav">
          {navigation.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              type="button"
              onClick={() => setPage(id)}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="session-box">
          <span>{isAdmin ? "관리자" : sessionMember?.name}</span>
          <button type="button" onClick={handleLogout}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </header>

      {(notice || error) && (
        <div className={error ? "message error" : "message"}>{error || notice}</div>
      )}

      {page === "home" && (
        <HomePage
          data={data}
          user={sessionMember}
          isAdmin={isAdmin}
          visibleClubIds={visibleClubIds}
          setPage={setPage}
          setSelectedClubId={setSelectedClubId}
          onAddPromo={addPromoPost}
          onDeletePromo={(id) => deleteRecord("promos", id)}
        />
      )}

      {page === "integrated" && (
        <IntegratedPage
          data={data}
          stats={stats}
          loading={loading}
          onRefresh={() => refreshData()}
        />
      )}

      {page === "club" && (
        <ClubPage
          data={data}
          user={sessionMember}
          isAdmin={isAdmin}
          selectedClub={selectedClub}
          selectedClubId={selectedClubId}
          setSelectedClubId={setSelectedClubId}
          clubTab={clubTab}
          setClubTab={setClubTab}
          onAddPost={addPost}
          onDeletePost={(id) => deleteRecord("posts", id)}
          onAddSchedule={addSchedule}
          onDeleteSchedule={(collection, id) => deleteRecord(collection, id)}
          onMarkAttendance={markAttendance}
        />
      )}

      {page === "admin" && isAdmin && (
        <AdminPage
          data={data}
          stats={stats}
          onDeletePost={(id) => deleteRecord("posts", id)}
          onDeletePromo={(id) => deleteRecord("promos", id)}
          onDeleteSchedule={(collection, id) => deleteRecord(collection, id)}
          onDeleteMember={deleteMember}
          onRefresh={() => refreshData()}
        />
      )}

      {page === "profile" && !isAdmin && (
        <ProfilePage
          data={data}
          user={sessionMember}
          onSave={handleProfileSave}
          onPasswordChange={handlePasswordChange}
        />
      )}
    </main>
  );
}

function AuthScreen({
  authMode,
  setAuthMode,
  onLogin,
  onRegister,
  loading,
  error,
  notice,
}) {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-title">
          <span className="brand-mark">낭</span>
          <h1>낭만모임</h1>
          <p>부경대 사회복지학 전공동아리 모이다</p>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={authMode === "login" ? "active" : ""}
            onClick={() => setAuthMode("login")}
          >
            로그인
          </button>
          <button
            type="button"
            className={authMode === "register" ? "active" : ""}
            onClick={() => setAuthMode("register")}
          >
            신규 가입
          </button>
        </div>

        {(notice || error) && (
          <div className={error ? "message error" : "message"}>{error || notice}</div>
        )}

        {authMode === "login" ? (
          <LoginForm onSubmit={onLogin} loading={loading} />
        ) : (
          <RegisterForm onSubmit={onRegister} loading={loading} />
        )}
      </section>
    </main>
  );
}

function LoginForm({ onSubmit, loading }) {
  const [form, setForm] = useState({ name: "", password: "" });
  const [showPw, setShowPw] = useState(false);

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label>
        이름 또는 관리자 ID
        <input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="이름 입력"
        />
      </label>
      <label>
        비밀번호
        <span className="password-field">
          <input
            type={showPw ? "text" : "password"}
            value={form.password}
            maxLength={8}
            onChange={(event) =>
              setForm({
                ...form,
                password: event.target.value.replace(/\D/g, ""),
              })
            }
            placeholder="8자리 숫자"
          />
          <button type="button" onClick={() => setShowPw((value) => !value)}>
            {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </span>
      </label>
      <button className="primary-button" disabled={loading} type="submit">
        로그인
      </button>
    </form>
  );
}

function RegisterForm({ onSubmit, loading }) {
  const [form, setForm] = useState({
    name: "",
    studentYear: "",
    gender: "female",
    status: "active",
    password: "",
    passwordConfirm: "",
    clubs: [],
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
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(form);
      }}
    >
      <label>
        이름
        <input
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          placeholder="실명 입력"
        />
      </label>
      <label>
        학번
        <select
          value={form.studentYear}
          onChange={(event) =>
            setForm({ ...form, studentYear: event.target.value })
          }
        >
          <option value="">학번 선택</option>
          {YEARS.map((year) => (
            <option key={year} value={year}>
              {year}학번
            </option>
          ))}
        </select>
      </label>
      <div className="split-fields">
        <label>
          성별
          <select
            value={form.gender}
            onChange={(event) => setForm({ ...form, gender: event.target.value })}
          >
            <option value="female">여성</option>
            <option value="male">남성</option>
            <option value="other">기타</option>
          </select>
        </label>
        <label>
          재적 상태
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="active">현역</option>
            <option value="graduated">졸업생</option>
          </select>
        </label>
      </div>
      <ClubPicker selected={form.clubs} onToggle={toggleClub} />
      <div className="split-fields">
        <label>
          비밀번호
          <input
            type="password"
            value={form.password}
            maxLength={8}
            onChange={(event) =>
              setForm({
                ...form,
                password: event.target.value.replace(/\D/g, ""),
              })
            }
            placeholder="숫자 8자리"
          />
        </label>
        <label>
          비밀번호 확인
          <input
            type="password"
            value={form.passwordConfirm}
            maxLength={8}
            onChange={(event) =>
              setForm({
                ...form,
                passwordConfirm: event.target.value.replace(/\D/g, ""),
              })
            }
            placeholder="다시 입력"
          />
        </label>
      </div>
      <button className="primary-button" disabled={loading} type="submit">
        가입하기
      </button>
    </form>
  );
}

function HomePage({
  data,
  user,
  isAdmin,
  visibleClubIds,
  setPage,
  setSelectedClubId,
  onAddPromo,
  onDeletePromo,
}) {
  const [draft, setDraft] = useState({ clubId: visibleClubIds[0] || "hora", title: "", content: "" });
  const writableClubs = isAdmin
    ? CLUB_LIST
    : CLUB_LIST.filter((club) => user?.clubs?.includes(club.id));
  const visiblePromos = data.promos.filter(
    (promo) => isAdmin || visibleClubIds.includes(promo.clubId),
  );

  async function submitPromo(event) {
    event.preventDefault();
    if (!draft.clubId || !draft.title.trim() || !draft.content.trim()) return;
    await onAddPromo(draft);
    setDraft({ clubId: writableClubs[0]?.id || "hora", title: "", content: "" });
  }

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <div>
          <p>국립부경대학교 사회복지학과 전공동아리</p>
          <h1>낭만 있는 사복 이야기</h1>
          <span>로그인 정보와 회원 정보는 Firebase의 같은 회원 레코드로 동기화됩니다.</span>
        </div>
        <div className="club-card-row">
          {CLUB_LIST.map((club) => (
            <button
              key={club.id}
              className="club-card"
              style={{ "--club-color": club.color, "--club-bg": club.bg }}
              type="button"
              onClick={() => {
                setSelectedClubId(club.id);
                setPage("club");
              }}
            >
              <strong>{club.name}</strong>
              <span>{data.members.filter((member) => member.clubs?.includes(club.id)).length}명</span>
            </button>
          ))}
        </div>
      </section>

      {writableClubs.length > 0 && (
        <section className="panel">
          <div className="panel-title">
            <Megaphone size={18} />
            홍보글 작성
          </div>
          <form className="inline-stack" onSubmit={submitPromo}>
            <select
              value={draft.clubId}
              onChange={(event) => setDraft({ ...draft, clubId: event.target.value })}
            >
              {writableClubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="제목"
            />
            <textarea
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              placeholder="내용"
            />
            <button className="primary-button" type="submit">
              <Plus size={17} />
              등록
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-title">
          <Megaphone size={18} />
          홍보 게시판
        </div>
        <div className="card-list">
          {visiblePromos.length === 0 ? (
            <p className="empty-state">등록된 홍보글이 없습니다.</p>
          ) : (
            visiblePromos.map((promo) => (
              <article className="post-card" key={promo.id}>
                <ClubBadge clubId={promo.clubId} />
                <h3>{promo.title}</h3>
                <p>{promo.content}</p>
                <footer>
                  <span>{promo.authorName} · {formatDate(promo.createdAt)}</span>
                  {isAdmin && (
                    <button type="button" onClick={() => onDeletePromo(promo.id)}>
                      <Trash2 size={15} />
                      삭제
                    </button>
                  )}
                </footer>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function IntegratedPage({ data, stats, loading, onRefresh }) {
  const totalAttendance = data.attendance.length;
  return (
    <div className="page-grid">
      <SectionHeader
        icon={BarChart3}
        title="통합 현황"
        action={
          <button className="ghost-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            {loading ? "불러오는 중" : "새로고침"}
          </button>
        }
      />
      <div className="metric-grid">
        <Metric label="전체 회원" value={`${data.members.length}명`} />
        <Metric label="게시글" value={`${data.posts.length}개`} />
        <Metric label="출석 기록" value={`${totalAttendance}건`} />
      </div>
      <section className="panel">
        <div className="comparison-grid">
          {stats.map((stat) => (
            <article className="club-stat" key={stat.club.id}>
              <ClubBadge clubId={stat.club.id} />
              <strong>{stat.memberCount}명</strong>
              <span>게시글 {stat.postCount}개 · 출석률 {stat.attendanceRate}%</span>
              <div className="progress">
                <span
                  style={{
                    width: `${stat.attendanceRate}%`,
                    background: stat.club.color,
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <Users size={18} />
          전체 회원
        </div>
        <MemberTable members={data.members} />
      </section>
    </div>
  );
}

function ClubPage({
  data,
  user,
  isAdmin,
  selectedClub,
  selectedClubId,
  setSelectedClubId,
  clubTab,
  setClubTab,
  onAddPost,
  onDeletePost,
  onAddSchedule,
  onDeleteSchedule,
  onMarkAttendance,
}) {
  const isMember = isAdmin || user?.clubs?.includes(selectedClubId);

  return (
    <div className="page-grid">
      <section
        className="club-hero"
        style={{ "--club-color": selectedClub.color, "--club-bg": selectedClub.bg }}
      >
        <div>
          <p>{selectedClub.english}</p>
          <h1>{selectedClub.name}</h1>
          <span>{selectedClub.description}</span>
        </div>
        <select
          value={selectedClubId}
          onChange={(event) => setSelectedClubId(event.target.value)}
        >
          {CLUB_LIST.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </section>

      {!isMember ? (
        <section className="panel empty-state">
          이 동아리의 회원이 아닙니다.
        </section>
      ) : (
        <>
          <div className="tabs">
            {[
              ["board", selectedClub.boardName],
              ["schedule", "일정"],
              ["event", "이벤트"],
              ["attendance", "출석"],
              ["members", "회원"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={clubTab === id ? "active" : ""}
                onClick={() => setClubTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {clubTab === "board" && (
            <BoardPanel
              posts={data.posts.filter((post) => post.clubId === selectedClubId)}
              isAdmin={isAdmin}
              user={user}
              onAddPost={onAddPost}
              onDeletePost={onDeletePost}
            />
          )}
          {clubTab === "schedule" && (
            <SchedulePanel
              collection="schedules"
              title="일정"
              items={data.schedules.filter((item) => item.clubId === selectedClubId)}
              isAdmin={isAdmin}
              onAddSchedule={onAddSchedule}
              onDeleteSchedule={onDeleteSchedule}
            />
          )}
          {clubTab === "event" && (
            <SchedulePanel
              collection="events"
              title="이벤트"
              items={data.events.filter((item) => item.clubId === selectedClubId)}
              isAdmin={isAdmin}
              onAddSchedule={onAddSchedule}
              onDeleteSchedule={onDeleteSchedule}
              withDescription
            />
          )}
          {clubTab === "attendance" && (
            <AttendancePanel
              data={data}
              user={user}
              isAdmin={isAdmin}
              clubId={selectedClubId}
              onMarkAttendance={onMarkAttendance}
            />
          )}
          {clubTab === "members" && (
            <section className="panel">
              <div className="panel-title">
                <Users size={18} />
                동아리 회원
              </div>
              <MemberTable
                members={data.members.filter((member) =>
                  member.clubs?.includes(selectedClubId),
                )}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function BoardPanel({ posts, isAdmin, user, onAddPost, onDeletePost }) {
  const [draft, setDraft] = useState({ content: "", anonymous: false });

  async function submit(event) {
    event.preventDefault();
    if (!draft.content.trim()) return;
    await onAddPost(draft);
    setDraft({ content: "", anonymous: false });
  }

  return (
    <section className="panel">
      <form className="inline-stack" onSubmit={submit}>
        <textarea
          value={draft.content}
          onChange={(event) => setDraft({ ...draft, content: event.target.value })}
          placeholder="게시판에 글을 남겨보세요."
        />
        <label className="check-line">
          <input
            type="checkbox"
            checked={draft.anonymous}
            onChange={(event) =>
              setDraft({ ...draft, anonymous: event.target.checked })
            }
          />
          익명으로 작성
        </label>
        <button className="primary-button" type="submit">
          <Plus size={17} />
          등록
        </button>
      </form>
      <div className="card-list">
        {posts.length === 0 ? (
          <p className="empty-state">첫 번째 글을 남겨보세요.</p>
        ) : (
          posts.map((post) => (
            <article className="post-card" key={post.id}>
              <h3>{post.isAnon ? "익명" : post.authorName}</h3>
              <p>{post.content}</p>
              <footer>
                <span>{formatDate(post.createdAt)}</span>
                {(isAdmin || post.authorId === user?.id) && (
                  <button type="button" onClick={() => onDeletePost(post.id)}>
                    <Trash2 size={15} />
                    삭제
                  </button>
                )}
              </footer>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function SchedulePanel({
  collection,
  title,
  items,
  isAdmin,
  onAddSchedule,
  onDeleteSchedule,
  withDescription = false,
}) {
  const [draft, setDraft] = useState({
    title: "",
    date: new Date().toISOString().slice(0, 10),
    type: "other",
    week: "",
    description: "",
  });

  async function submit(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.date) return;
    await onAddSchedule(collection, draft);
    setDraft({
      title: "",
      date: new Date().toISOString().slice(0, 10),
      type: "other",
      week: "",
      description: "",
    });
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CalendarDays size={18} />
        {title}
      </div>
      {isAdmin && (
        <form className="inline-stack" onSubmit={submit}>
          <input
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder={`${title} 제목`}
          />
          <input
            type="date"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
          {!withDescription && (
            <input
              value={draft.week}
              onChange={(event) => setDraft({ ...draft, week: event.target.value })}
              placeholder="주차 또는 메모"
            />
          )}
          {withDescription && (
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder="설명"
            />
          )}
          <button className="primary-button" type="submit">
            <Plus size={17} />
            추가
          </button>
        </form>
      )}
      <div className="card-list">
        {items.length === 0 ? (
          <p className="empty-state">등록된 항목이 없습니다.</p>
        ) : (
          items.map((item) => (
            <article className="schedule-card" key={item.id}>
              <strong>{item.title}</strong>
              <span>{formatDate(item.date)}</span>
              {item.week && <p>{item.week}</p>}
              {item.description && <p>{item.description}</p>}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onDeleteSchedule(collection, item.id)}
                >
                  <Trash2 size={15} />
                  삭제
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function AttendancePanel({ data, user, isAdmin, clubId, onMarkAttendance }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const clubMembers = data.members.filter((member) => member.clubs?.includes(clubId));
  const statuses = [
    ["present", "출석"],
    ["late", "지각"],
    ["absent", "결석"],
  ];

  if (!isAdmin) {
    const rows = data.attendance.filter(
      (item) => item.clubId === clubId && item.memberId === user.id,
    );
    const present = rows.filter((row) => row.status === "present").length;
    const rate = rows.length ? Math.round((present / rows.length) * 100) : 0;
    return (
      <section className="panel">
        <div className="panel-title">
          <CheckCircle2 size={18} />
          내 출석 현황
        </div>
        <div className="metric-grid">
          <Metric label="출석률" value={`${rate}%`} />
          <Metric label="출석" value={`${present}회`} />
          <Metric label="전체 기록" value={`${rows.length}회`} />
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <CheckCircle2 size={18} />
        출석 관리
      </div>
      <label className="date-row">
        날짜
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <div className="card-list">
        {clubMembers.map((member) => {
          const key = `${clubId}_${member.id}_${date}`;
          const selected = data.attendance.find((item) => item.key === key)?.status;
          return (
            <article className="attendance-card" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <span>{member.studentYear}학번</span>
              </div>
              <div className="button-row">
                {statuses.map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    className={selected === status ? "active" : ""}
                    onClick={() => onMarkAttendance(member.id, date, status)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AdminPage({
  data,
  stats,
  onDeletePost,
  onDeletePromo,
  onDeleteSchedule,
  onDeleteMember,
  onRefresh,
}) {
  return (
    <div className="page-grid">
      <SectionHeader
        icon={ShieldCheck}
        title="관리자 패널"
        action={
          <button className="ghost-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            Firebase 새로고침
          </button>
        }
      />
      <div className="metric-grid">
        {stats.map((stat) => (
          <Metric
            key={stat.club.id}
            label={stat.club.name}
            value={`${stat.memberCount}명`}
          />
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <Users size={18} />
          회원 관리
        </div>
        <div className="admin-list">
          {data.members.map((member) => (
            <article className="admin-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <span>{member.studentYear}학번 · {member.status === "graduated" ? "졸업생" : "현역"}</span>
              </div>
              <div className="club-pill-row">
                {(member.clubs || []).map((clubId) => (
                  <ClubBadge key={clubId} clubId={clubId} />
                ))}
              </div>
              <button type="button" onClick={() => onDeleteMember(member)}>
                <Trash2 size={15} />
                삭제
              </button>
            </article>
          ))}
        </div>
      </section>
      <AdminCollection
        title="게시글"
        items={data.posts}
        renderMain={(item) => item.content}
        onDelete={onDeletePost}
      />
      <AdminCollection
        title="홍보글"
        items={data.promos}
        renderMain={(item) => item.title}
        onDelete={onDeletePromo}
      />
      <AdminCollection
        title="일정"
        items={data.schedules}
        renderMain={(item) => item.title}
        onDelete={(id) => onDeleteSchedule("schedules", id)}
      />
      <AdminCollection
        title="이벤트"
        items={data.events}
        renderMain={(item) => item.title}
        onDelete={(id) => onDeleteSchedule("events", id)}
      />
    </div>
  );
}

function AdminCollection({ title, items, renderMain, onDelete }) {
  return (
    <section className="panel">
      <div className="panel-title">{title} 관리</div>
      <div className="admin-list">
        {items.length === 0 ? (
          <p className="empty-state">등록된 항목이 없습니다.</p>
        ) : (
          items.map((item) => (
            <article className="admin-row" key={item.id}>
              <ClubBadge clubId={item.clubId} />
              <strong>{renderMain(item)}</strong>
              <button type="button" onClick={() => onDelete(item.id)}>
                <Trash2 size={15} />
                삭제
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ProfilePage({ data, user, onSave, onPasswordChange }) {
  const [editing, setEditing] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const myPosts = data.posts.filter((post) => post.authorId === user.id);

  return (
    <div className="page-grid">
      <section className="profile-hero">
        <div className="avatar">{user.name?.slice(0, 1)}</div>
        <div>
          <h1>{user.name}</h1>
          <p>{user.studentYear}학번 · {user.status === "graduated" ? "졸업생" : "현역"}</p>
          <div className="club-pill-row">
            {(user.clubs || []).map((clubId) => (
              <ClubBadge key={clubId} clubId={clubId} />
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <User size={18} />
          내 정보
        </div>
        <div className="info-grid">
          <Info label="이름" value={user.name} />
          <Info label="학번" value={`${user.studentYear}학번`} />
          <Info label="성별" value={genderLabel(user.gender)} />
          <Info label="재적 상태" value={user.status === "graduated" ? "졸업생" : "현역"} />
          <Info label="작성 게시글" value={`${myPosts.length}개`} />
          <Info label="최종 수정" value={user.updatedAt ? formatDate(user.updatedAt) : "-"} />
        </div>
        <div className="button-row end">
          <button className="ghost-button" type="button" onClick={() => setChangingPw((value) => !value)}>
            <KeyRound size={16} />
            비밀번호 변경
          </button>
          <button className="primary-button" type="button" onClick={() => setEditing((value) => !value)}>
            <Pencil size={16} />
            정보 수정
          </button>
        </div>
      </section>

      {editing && (
        <ProfileEditor
          user={user}
          onCancel={() => setEditing(false)}
          onSave={async (form) => {
            await onSave(form);
            setEditing(false);
          }}
        />
      )}

      {changingPw && (
        <PasswordEditor
          onCancel={() => setChangingPw(false)}
          onSave={async (oldPassword, newPassword) => {
            await onPasswordChange(oldPassword, newPassword);
            setChangingPw(false);
          }}
        />
      )}

      <section className="panel">
        <div className="panel-title">
          <Users size={18} />
          내가 쓴 글
        </div>
        <div className="card-list">
          {myPosts.length === 0 ? (
            <p className="empty-state">아직 작성한 글이 없습니다.</p>
          ) : (
            myPosts.map((post) => (
              <article className="post-card" key={post.id}>
                <ClubBadge clubId={post.clubId} />
                <p>{post.content}</p>
                <footer>{formatDate(post.createdAt)}</footer>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ProfileEditor({ user, onSave, onCancel }) {
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
    setError("");
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message || "정보 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel accent-panel">
      <div className="panel-title">
        <Pencil size={18} />
        내 정보 수정
      </div>
      {error && <div className="message error">{error}</div>}
      <form className="form-stack" onSubmit={submit}>
        <label>
          이름
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <div className="split-fields">
          <label>
            학번
            <select
              value={form.studentYear}
              onChange={(event) =>
                setForm({ ...form, studentYear: event.target.value })
              }
            >
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}학번
                </option>
              ))}
            </select>
          </label>
          <label>
            성별
            <select
              value={form.gender}
              onChange={(event) => setForm({ ...form, gender: event.target.value })}
            >
              <option value="female">여성</option>
              <option value="male">남성</option>
              <option value="other">기타</option>
            </select>
          </label>
        </div>
        <label>
          재적 상태
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            <option value="active">현역</option>
            <option value="graduated">졸업생</option>
          </select>
        </label>
        <ClubPicker selected={form.clubs} onToggle={toggleClub} />
        <div className="button-row end">
          <button className="ghost-button" type="button" onClick={onCancel}>
            취소
          </button>
          <button className="primary-button" disabled={saving} type="submit">
            <Save size={16} />
            저장하기
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordEditor({ onSave, onCancel }) {
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (form.newPassword !== form.confirmPassword) {
      setError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    try {
      await onSave(form.oldPassword, form.newPassword);
    } catch (err) {
      setError(err.message || "비밀번호 변경에 실패했습니다.");
    }
  }

  return (
    <section className="panel accent-panel">
      <div className="panel-title">
        <KeyRound size={18} />
        비밀번호 변경
      </div>
      {error && <div className="message error">{error}</div>}
      <form className="form-stack" onSubmit={submit}>
        <input
          type="password"
          value={form.oldPassword}
          maxLength={8}
          onChange={(event) =>
            setForm({ ...form, oldPassword: event.target.value.replace(/\D/g, "") })
          }
          placeholder="현재 비밀번호"
        />
        <div className="split-fields">
          <input
            type="password"
            value={form.newPassword}
            maxLength={8}
            onChange={(event) =>
              setForm({ ...form, newPassword: event.target.value.replace(/\D/g, "") })
            }
            placeholder="새 비밀번호"
          />
          <input
            type="password"
            value={form.confirmPassword}
            maxLength={8}
            onChange={(event) =>
              setForm({
                ...form,
                confirmPassword: event.target.value.replace(/\D/g, ""),
              })
            }
            placeholder="새 비밀번호 확인"
          />
        </div>
        <div className="button-row end">
          <button className="ghost-button" type="button" onClick={onCancel}>
            취소
          </button>
          <button className="primary-button" type="submit">
            변경하기
          </button>
        </div>
      </form>
    </section>
  );
}

function ClubPicker({ selected, onToggle }) {
  return (
    <div className="club-picker">
      <span>소속 동아리</span>
      <div>
        {CLUB_LIST.map((club) => (
          <button
            key={club.id}
            type="button"
            className={selected.includes(club.id) ? "selected" : ""}
            style={{ "--club-color": club.color, "--club-bg": club.bg }}
            onClick={() => onToggle(club.id)}
          >
            <span className="swatch" />
            {club.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function MemberTable({ members }) {
  if (members.length === 0) {
    return <p className="empty-state">등록된 회원이 없습니다.</p>;
  }
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
              <td>{member.name}</td>
              <td>{member.studentYear}</td>
              <td>{genderLabel(member.gender)}</td>
              <td>{member.status === "graduated" ? "졸업생" : "현역"}</td>
              <td>
                <div className="club-pill-row">
                  {(member.clubs || []).map((clubId) => (
                    <ClubBadge key={clubId} clubId={clubId} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, action }) {
  return (
    <header className="section-header">
      <div>
        <Icon size={24} />
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

function Metric({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ClubBadge({ clubId }) {
  const club = CLUBS[clubId] || { name: clubId, color: "#777", bg: "#f0f0f0" };
  return (
    <span
      className="club-badge"
      style={{ "--club-color": club.color, "--club-bg": club.bg }}
    >
      <span className="swatch" />
      {club.name}
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div className="info-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function fetchRemoteData() {
  const [
    members,
    posts,
    schedules,
    events,
    attendance,
    promos,
    pwRequests,
    withdrawals,
  ] = await Promise.all([
    fbGet("members"),
    fbGet("posts"),
    fbGet("schedules"),
    fbGet("events"),
    fbGet("attendance"),
    fbGet("promos"),
    fbGet("pwRequests"),
    fbGet("withdrawals"),
  ]);

  return {
    members: toArray(members),
    posts: toArray(posts).sort(sortNewest),
    schedules: toArray(schedules).sort(sortNewest),
    events: toArray(events).sort(sortNewest),
    attendance: toArray(attendance, "key"),
    promos: toArray(promos).sort(sortNewest),
    pwRequests: toArray(pwRequests).sort(sortNewest),
    withdrawals: toArray(withdrawals).sort(sortNewest),
  };
}

function reconcileSession(remoteData, currentUser, currentIsAdmin) {
  if (!currentUser || currentIsAdmin || currentUser.id === "admin") {
    return { nextData: remoteData, nextUser: currentUser, memberToRepair: null };
  }

  const remoteMember = remoteData.members.find(
    (member) => member.id === currentUser.id,
  );

  if (!remoteMember) {
    return { nextData: remoteData, nextUser: null, memberToRepair: null };
  }

  const localTime = recordTime(currentUser);
  const remoteTime = recordTime(remoteMember);

  if (remoteTime >= localTime) {
    return { nextData: remoteData, nextUser: remoteMember, memberToRepair: null };
  }

  const repairedMember = {
    ...currentUser,
    updatedAt: currentUser.updatedAt || new Date().toISOString(),
  };

  return {
    nextData: {
      ...remoteData,
      members: upsertById(remoteData.members, repairedMember),
    },
    nextUser: repairedMember,
    memberToRepair: repairedMember,
  };
}

async function persistMember(member) {
  await fbPut(`members/${firebaseRecordKey(member, member.id)}`, cleanFirebase(member));
}

async function fbGet(path) {
  const response = await fetch(`${DB}/${path}.json`);
  if (!response.ok) {
    throw new Error(`Firebase GET ${path} failed: ${response.status}`);
  }
  const data = await response.json();
  return data === null ? undefined : data;
}

async function fbPut(path, value) {
  const response = await fetch(`${DB}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Firebase PUT ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function fbPatch(path, value) {
  const response = await fetch(`${DB}/${path}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Firebase PATCH ${path} failed: ${response.status} ${text}`);
  }
  return response.json();
}

async function fbDelete(path) {
  const response = await fetch(`${DB}/${path}.json`, { method: "DELETE" });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Firebase DELETE ${path} failed: ${response.status} ${text}`);
  }
}

function readLocalData() {
  return {
    ...EMPTY_DATA,
    members: readStorage(STORAGE.members, []),
    posts: readStorage(STORAGE.posts, []),
    schedules: readStorage(STORAGE.schedules, []),
    events: readStorage(STORAGE.events, []),
    attendance: readStorage(STORAGE.attendance, []),
    promos: readStorage(STORAGE.promos, []),
    pwRequests: readStorage(STORAGE.pwRequests, []),
    withdrawals: readStorage(STORAGE.withdrawals, []),
  };
}

function saveLocalData(data) {
  writeStorage(STORAGE.members, data.members);
  writeStorage(STORAGE.posts, data.posts);
  writeStorage(STORAGE.schedules, data.schedules);
  writeStorage(STORAGE.events, data.events);
  writeStorage(STORAGE.attendance, data.attendance);
  writeStorage(STORAGE.promos, data.promos);
  writeStorage(STORAGE.pwRequests, data.pwRequests);
  writeStorage(STORAGE.withdrawals, data.withdrawals);
}

function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function toArray(value, idField = "id") {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return Object.entries(value)
    .filter(([, item]) => item && typeof item === "object")
    .map(([key, item]) => ({
      ...item,
      [idField]: item[idField] || key,
      _fbKey: key,
    }));
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

function firebaseKey(value) {
  return String(value).replace(/[.$#[\]/]/g, "_");
}

function firebaseRecordKey(record, fallback) {
  return firebaseKey(record?._fbKey || record?.id || fallback);
}

function upsertById(items, item) {
  return upsertByKey(items, item, "id");
}

function upsertByKey(items, item, keyField) {
  const found = items.some((entry) => entry[keyField] === item[keyField]);
  if (!found) return [item, ...items];
  return items.map((entry) =>
    entry[keyField] === item[keyField] ? item : entry,
  );
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function recordTime(record) {
  return (
    Date.parse(record?.updatedAt || "") ||
    Date.parse(record?.createdAt || "") ||
    Date.parse(record?.withdrawnAt || "") ||
    Date.parse(record?.repliedAt || "") ||
    Date.parse(record?.joinedAt || "") ||
    Date.parse(record?.date || "") ||
    0
  );
}

function sortNewest(a, b) {
  return recordTime(b) - recordTime(a);
}

function buildClubStats(club, data) {
  const members = data.members.filter((member) => member.clubs?.includes(club.id));
  const attendance = data.attendance.filter((item) => item.clubId === club.id);
  const present = attendance.filter((item) => item.status === "present").length;
  return {
    club,
    memberCount: members.length,
    postCount: data.posts.filter((post) => post.clubId === club.id).length,
    attendanceRate: attendance.length
      ? Math.round((present / attendance.length) * 100)
      : 0,
  };
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function genderLabel(value) {
  if (value === "male") return "남성";
  if (value === "female") return "여성";
  return "기타";
}

function isFormFieldFocused() {
  const active = document.activeElement;
  if (!active) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

export default App;
