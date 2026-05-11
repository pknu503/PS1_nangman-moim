import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
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
  promos: "nm_promos",
  attendance: "nm_attend",
};

const CLUBS = {
  hora: {
    id: "hora",
    name: "오라",
    english: "Hora",
    color: "#7d65b3",
    bg: "#f1edf9",
    boardName: "오라타임",
  },
  myth: {
    id: "myth",
    name: "클럽신화",
    english: "MYTH",
    color: "#bd6538",
    bg: "#fff0e8",
    boardName: "신화창조",
  },
  theme: {
    id: "theme",
    name: "띰",
    english: "Theme",
    color: "#3f73bc",
    bg: "#eaf1fb",
    boardName: "테마찾기",
  },
};

const CLUB_LIST = Object.values(CLUBS);

export default function App() {
  const [data, setData] = useState(readLocalData);
  const [user, setUser] = useState(() => readStorage(STORAGE.user, null));
  const [isAdmin, setIsAdmin] = useState(() => readStorage(STORAGE.admin, false));
  const [authMode, setAuthMode] = useState("login");
  const [page, setPage] = useState(user ? "home" : "auth");
  const [selectedClubId, setSelectedClubId] = useState("hora");
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

  const selectedClub = CLUBS[selectedClubId];
  const myClubIds = isAdmin ? CLUB_LIST.map((club) => club.id) : sessionUser?.clubs || [];

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
      setError("이름과 비밀번호를 입력해주세요.");
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

      const member = {
        id: makeId("member"),
        name: form.name.trim(),
        studentYear: form.studentYear,
        gender: form.gender,
        status: form.status,
        clubs: form.clubs,
        password: form.password,
        joinedAt: now(),
        updatedAt: now(),
      };
      await persistMember(member);
      setData({ ...remote, members: upsertById(remote.members, member) });
      setUser(member);
      setIsAdmin(false);
      setPage("home");
      setMessage("가입 정보가 Firebase에 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setError("가입 정보를 Firebase에 저장하지 못했습니다.");
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
    if (!form.title.trim() || !form.content.trim()) return;
    const item = {
      id: makeId("promo"),
      clubId: form.clubId,
      title: form.title.trim(),
      content: form.content.trim(),
      authorId: sessionUser.id,
      authorName: sessionUser.name,
      createdAt: now(),
    };
    setData((current) => ({ ...current, promos: [item, ...current.promos] }));
    await fbPatch("promos", { [firebaseKey(item.id)]: cleanFirebase(item) });
  }

  async function deleteRecord(collection, record) {
    if (!window.confirm("삭제할까요?")) return;
    setData((current) => ({
      ...current,
      [collection]: current[collection].filter((item) => item.id !== record.id),
    }));
    await fbDelete(`${collection}/${firebaseRecordKey(record, record.id)}`);
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
          <span>낭</span>
          <strong>낭만모임</strong>
        </button>
        <nav>
          <NavButton id="home" page={page} setPage={setPage} icon={Home} label="홈" />
          <NavButton id="integrated" page={page} setPage={setPage} icon={BarChart3} label="통합현황" />
          <NavButton id="club" page={page} setPage={setPage} icon={Users} label="동아리" />
          {isAdmin && <NavButton id="admin" page={page} setPage={setPage} icon={ShieldCheck} label="관리자" />}
          {!isAdmin && <NavButton id="profile" page={page} setPage={setPage} icon={User} label="내 정보" />}
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
          setPage={setPage}
          setSelectedClubId={setSelectedClubId}
          addPromo={addPromo}
          deletePromo={(promo) => deleteRecord("promos", promo)}
        />
      )}
      {page === "integrated" && (
        <IntegratedPage data={data} loading={loading} refresh={() => refreshData()} />
      )}
      {page === "club" && (
        <ClubPage
          data={data}
          user={sessionUser}
          isAdmin={isAdmin}
          selectedClub={selectedClub}
          selectedClubId={selectedClubId}
          setSelectedClubId={setSelectedClubId}
          addPost={addPost}
          deletePost={(post) => deleteRecord("posts", post)}
        />
      )}
      {page === "profile" && !isAdmin && (
        <ProfilePage user={sessionUser} saveProfile={saveProfile} changePassword={changePassword} />
      )}
      {page === "admin" && isAdmin && (
        <AdminPage data={data} deleteRecord={deleteRecord} refresh={() => refreshData()} />
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
        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            로그인
          </button>
          <button className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
            신규 가입
          </button>
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
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </label>
      <label>
        비밀번호
        <input
          type="password"
          maxLength={8}
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value.replace(/\D/g, "") })}
        />
      </label>
      <button className="primary" disabled={loading} type="submit">로그인</button>
    </form>
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
        <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
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
          <option value="active">현역</option>
          <option value="graduated">졸업생</option>
        </select>
      </label>
      <ClubPicker selected={form.clubs} toggle={toggleClub} />
      <div className="two">
        <label>
          비밀번호
          <input
            type="password"
            maxLength={8}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value.replace(/\D/g, "") })}
          />
        </label>
        <label>
          비밀번호 확인
          <input
            type="password"
            maxLength={8}
            value={form.passwordConfirm}
            onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value.replace(/\D/g, "") })}
          />
        </label>
      </div>
      <button className="primary" disabled={loading} type="submit">가입하기</button>
    </form>
  );
}

function HomePage({ data, isAdmin, user, myClubIds, setPage, setSelectedClubId, addPromo, deletePromo }) {
  const [form, setForm] = useState({ clubId: myClubIds[0] || "hora", title: "", content: "" });
  const visiblePromos = isAdmin ? data.promos : data.promos.filter((promo) => myClubIds.includes(promo.clubId));
  const writableClubs = isAdmin ? CLUB_LIST : CLUB_LIST.filter((club) => user.clubs?.includes(club.id));

  return (
    <div className="stack">
      <section className="hero">
        <div>
          <p>국립부경대학교 사회복지학과 전공동아리</p>
          <h1>낭만 있는 사복 이야기</h1>
          <span>정보 수정값은 Firebase의 회원 레코드와 로그인 세션에 동시에 저장됩니다.</span>
        </div>
        <div className="club-grid">
          {CLUB_LIST.map((club) => (
            <button
              key={club.id}
              className="club-card"
              style={{ "--club": club.color, "--club-bg": club.bg }}
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
          <h2><Megaphone size={19} /> 홍보글 작성</h2>
          <form className="form" onSubmit={(event) => { event.preventDefault(); addPromo(form); setForm({ ...form, title: "", content: "" }); }}>
            <select value={form.clubId} onChange={(event) => setForm({ ...form, clubId: event.target.value })}>
              {writableClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
            </select>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
            <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
            <button className="primary" type="submit"><Plus size={17} /> 등록</button>
          </form>
        </section>
      )}

      <section className="panel">
        <h2><Megaphone size={19} /> 홍보 게시판</h2>
        <PostList posts={visiblePromos} isAdmin={isAdmin} deletePost={deletePromo} isPromo />
      </section>
    </div>
  );
}

function IntegratedPage({ data, loading, refresh }) {
  return (
    <div className="stack">
      <section className="toolbar">
        <h1>통합 현황</h1>
        <button type="button" onClick={refresh}><RefreshCw size={16} /> {loading ? "불러오는 중" : "새로고침"}</button>
      </section>
      <div className="metrics">
        <Metric label="전체 회원" value={`${data.members.length}명`} />
        <Metric label="게시글" value={`${data.posts.length}개`} />
        <Metric label="홍보글" value={`${data.promos.length}개`} />
      </div>
      <section className="panel">
        <h2><Users size={19} /> 전체 회원</h2>
        <MemberTable members={data.members} />
      </section>
    </div>
  );
}

function ClubPage({ data, user, isAdmin, selectedClub, selectedClubId, setSelectedClubId, addPost, deletePost }) {
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const isMember = isAdmin || user.clubs?.includes(selectedClubId);
  const posts = data.posts.filter((post) => post.clubId === selectedClubId);
  const members = data.members.filter((member) => member.clubs?.includes(selectedClubId));

  return (
    <div className="stack">
      <section className="club-hero" style={{ "--club": selectedClub.color, "--club-bg": selectedClub.bg }}>
        <div>
          <p>{selectedClub.english}</p>
          <h1>{selectedClub.name}</h1>
          <span>{selectedClub.boardName}</span>
        </div>
        <select value={selectedClubId} onChange={(event) => setSelectedClubId(event.target.value)}>
          {CLUB_LIST.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </section>

      {!isMember ? (
        <section className="panel">이 동아리의 회원이 아닙니다.</section>
      ) : (
        <>
          <section className="panel">
            <h2>{selectedClub.boardName}</h2>
            <form className="form" onSubmit={(event) => { event.preventDefault(); addPost(content, anonymous); setContent(""); setAnonymous(false); }}>
              <textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="게시글을 남겨보세요." />
              <label className="inline">
                <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} />
                익명으로 작성
              </label>
              <button className="primary" type="submit"><Plus size={17} /> 등록</button>
            </form>
            <PostList posts={posts} isAdmin={isAdmin} currentUser={user} deletePost={deletePost} />
          </section>
          <section className="panel">
            <h2><Users size={19} /> 회원</h2>
            <MemberTable members={members} />
          </section>
        </>
      )}
    </div>
  );
}

function ProfilePage({ user, saveProfile, changePassword }) {
  const [editing, setEditing] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  return (
    <div className="stack">
      <section className="profile">
        <div className="avatar">{user.name?.slice(0, 1)}</div>
        <div>
          <h1>{user.name}</h1>
          <p>{user.studentYear}학번 · {genderLabel(user.gender)} · {user.status === "graduated" ? "졸업생" : "현역"}</p>
          <div className="badges">{(user.clubs || []).map((clubId) => <ClubBadge key={clubId} clubId={clubId} />)}</div>
        </div>
      </section>

      <section className="panel">
        <h2><User size={19} /> 내 정보</h2>
        <div className="info-grid">
          <Info label="이름" value={user.name} />
          <Info label="학번" value={`${user.studentYear}학번`} />
          <Info label="성별" value={genderLabel(user.gender)} />
          <Info label="재적 상태" value={user.status === "graduated" ? "졸업생" : "현역"} />
          <Info label="최종 수정" value={formatDate(user.updatedAt)} />
        </div>
        <div className="actions">
          <button type="button" onClick={() => setChangingPw(!changingPw)}><KeyRound size={16} /> 비밀번호 변경</button>
          <button className="primary" type="button" onClick={() => setEditing(!editing)}><Pencil size={16} /> 정보 수정</button>
        </div>
      </section>

      {editing && <ProfileEditor user={user} saveProfile={saveProfile} done={() => setEditing(false)} />}
      {changingPw && <PasswordEditor changePassword={changePassword} done={() => setChangingPw(false)} />}
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
            <option value="active">현역</option>
            <option value="graduated">졸업생</option>
          </select>
        </label>
        <ClubPicker selected={form.clubs} toggle={toggleClub} />
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
        <input type="password" maxLength={8} placeholder="현재 비밀번호" value={form.oldPassword} onChange={(event) => setForm({ ...form, oldPassword: event.target.value.replace(/\D/g, "") })} />
        <div className="two">
          <input type="password" maxLength={8} placeholder="새 비밀번호" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value.replace(/\D/g, "") })} />
          <input type="password" maxLength={8} placeholder="새 비밀번호 확인" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="actions">
          <button type="button" onClick={done}>취소</button>
          <button className="primary" type="submit">변경하기</button>
        </div>
      </form>
    </section>
  );
}

function AdminPage({ data, deleteRecord, refresh }) {
  return (
    <div className="stack">
      <section className="toolbar">
        <h1>관리자 패널</h1>
        <button type="button" onClick={refresh}><RefreshCw size={16} /> 새로고침</button>
      </section>
      <section className="panel">
        <h2><Users size={19} /> 회원</h2>
        <MemberTable members={data.members} />
      </section>
      <section className="panel">
        <h2>게시글 관리</h2>
        <PostList posts={data.posts} isAdmin deletePost={(post) => deleteRecord("posts", post)} />
      </section>
      <section className="panel">
        <h2>홍보글 관리</h2>
        <PostList posts={data.promos} isAdmin deletePost={(post) => deleteRecord("promos", post)} isPromo />
      </section>
    </div>
  );
}

function PostList({ posts, isAdmin, currentUser, deletePost, isPromo = false }) {
  if (posts.length === 0) return <p className="empty">등록된 글이 없습니다.</p>;
  return (
    <div className="cards">
      {posts.map((post) => (
        <article className="post" key={post.id}>
          <ClubBadge clubId={post.clubId} />
          {isPromo && <h3>{post.title}</h3>}
          <p>{isPromo ? post.content : post.content}</p>
          <footer>
            <span>{post.authorName} · {formatDate(post.createdAt)}</span>
            {(isAdmin || currentUser?.id === post.authorId) && (
              <button type="button" onClick={() => deletePost(post)}><Trash2 size={15} /> 삭제</button>
            )}
          </footer>
        </article>
      ))}
    </div>
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
              <td>{member.name}</td>
              <td>{member.studentYear}</td>
              <td>{genderLabel(member.gender)}</td>
              <td>{member.status === "graduated" ? "졸업생" : "현역"}</td>
              <td><div className="badges">{(member.clubs || []).map((clubId) => <ClubBadge key={clubId} clubId={clubId} />)}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClubPicker({ selected, toggle }) {
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

function NavButton({ id, page, setPage, icon: Icon, label }) {
  return (
    <button className={page === id ? "active" : ""} type="button" onClick={() => setPage(id)}>
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
  return (
    <span className="badge" style={{ "--club": club.color, "--club-bg": club.bg }}>
      {club.name}
    </span>
  );
}

async function fetchRemoteData() {
  const [members, posts, promos, attendance] = await Promise.all([
    fbGet("members"),
    fbGet("posts"),
    fbGet("promos"),
    fbGet("attendance"),
  ]);

  return {
    members: normalizeMembers(toArray(members)),
    posts: toArray(posts).sort(sortNewest),
    promos: toArray(promos).sort(sortNewest),
    attendance: toArray(attendance, "key"),
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
    members: readStorage(STORAGE.members, []),
    posts: readStorage(STORAGE.posts, []),
    promos: readStorage(STORAGE.promos, []),
    attendance: readStorage(STORAGE.attendance, []),
  };
}

function saveLocalData(data) {
  writeStorage(STORAGE.members, data.members);
  writeStorage(STORAGE.posts, data.posts);
  writeStorage(STORAGE.promos, data.promos);
  writeStorage(STORAGE.attendance, data.attendance);
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
  if (value === null || value === undefined) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function toArray(value, idField = "id") {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
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

function upsertById(items, item) {
  const exists = items.some((entry) => entry.id === item.id);
  return exists ? items.map((entry) => (entry.id === item.id ? item : entry)) : [item, ...items];
}

function firebaseKey(value) {
  return String(value).replace(/[.$#[\]/]/g, "_");
}

function firebaseRecordKey(record, fallback) {
  return firebaseKey(record?._fbKey || record?.id || fallback);
}

function recordTime(record) {
  return (
    Date.parse(record?.updatedAt || "") ||
    Date.parse(record?.createdAt || "") ||
    Date.parse(record?.joinedAt || "") ||
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function genderLabel(value) {
  if (value === "male") return "남성";
  if (value === "female") return "여성";
  return "기타";
}

function isEditingField() {
  const active = document.activeElement;
  return active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}
