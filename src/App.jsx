import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  query, orderBy, deleteDoc, doc, getDoc, updateDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  Play, Pause, Volume2, Maximize, LogOut, Upload, 
  Search, Plus, X, List, Share2, Film, Lock, Image as ImageIcon,
  ExternalLink, ChevronRight, Check, Youtube, Trash2, Pencil, 
  Facebook, Video, Filter, Instagram, Twitter, AtSign
} from 'lucide-react';

const APP_VERSION = "1.0.2"; // 🌟 版本號更新

// --- 設定區域 ---
const firebaseConfig = {
  apiKey: "AIzaSyAYhJ0BeSwR0i-x9HHAVXR2p_1dD0l-an4",
  authDomain: "video-faa49.firebaseapp.com",
  projectId: "video-faa49",
  storageBucket: "video-faa49.firebasestorage.app",
  messagingSenderId: "648988955584",
  appId: "1:648988955584:web:47ffd523c7f73a51f02e25",
  measurementId: "G-LTCZEXHP3B"
};

const configToUse = (typeof __firebase_config !== 'undefined') 
  ? JSON.parse(__firebase_config) 
  : firebaseConfig;

const app = initializeApp(configToUse);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'video-app';

const ADMIN_USER = "admin";
const ADMIN_PASS = "password123";

// --- Helper Functions: Multi-Platform Support ---
const getEmbedInfo = (url) => {
  if (!url) return null;

  const ytRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const ytMatch = url.match(ytRegExp);
  if (ytMatch && ytMatch[2].length === 11) {
    return { type: 'youtube', src: `https://www.youtube.com/embed/${ytMatch[2]}?autoplay=1`, id: ytMatch[2] };
  }

  const vimeoRegExp = /(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:[a-zA-Z0-9_\-]+)?/i;
  const vimeoMatch = url.match(vimeoRegExp);
  if (vimeoMatch && vimeoMatch[1]) {
    return { type: 'vimeo', src: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1` };
  }

  if (url.includes('facebook.com') || url.includes('fb.watch')) {
    const encodedUrl = encodeURIComponent(url);
    return { type: 'facebook', src: `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&t=0&autoplay=1` };
  }

  if (url.includes('tiktok.com')) {
    const videoIdMatch = url.match(/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    return { type: 'tiktok', src: videoId ? `https://www.tiktok.com/embed/v2/${videoId}?lang=zh-Hant-TW` : url, isShortLink: !videoId };
  }

  if (url.includes('douyin.com')) return { type: 'douyin', src: url };

  if (url.includes('instagram.com')) {
    const match = url.match(/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return { type: 'instagram', src: `https://www.instagram.com/p/${match[1]}/embed/captioned/` };
  }

  if (url.includes('threads.net') || url.includes('threads.com')) {
    const match = url.match(/\/post\/([^/?&]+)/);
    if (match && match[1]) return { type: 'threads', src: url };
  }

  if (url.includes('twitter.com') || url.includes('x.com')) {
    const match = url.match(/\/status\/(\d+)/);
    if (match && match[1]) return { type: 'twitter', src: `https://platform.twitter.com/embed/Tweet.html?id=${match[1]}` };
  }

  return { type: 'native', src: url };
};

const getYouTubeThumbnail = (id) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

// --- Components ---

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true); // 新增記住我狀態
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      onLogin(rememberMe);
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl w-full max-w-sm border border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
            <Film className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center mb-6">管理員登入</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">帳號</label>
            <input 
              type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-red-500"
              placeholder="輸入 admin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">密碼</label>
            <input 
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-red-500"
              placeholder="輸入密碼"
            />
          </div>
          
          <div className="flex items-center mt-2">
            <input 
              type="checkbox" id="remember" 
              checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} 
              className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
            />
            <label htmlFor="remember" className="ml-2 text-sm text-gray-400 cursor-pointer">
              保持登入狀態
            </label>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-semibold transition-colors mt-2">
            登入系統
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [videoToEdit, setVideoToEdit] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [sharedPlaylistId, setSharedPlaylistId] = useState(null);
  const [sharedPlaylistData, setSharedPlaylistData] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (e) { console.error("登入失敗:", e); }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    
    // 檢查 localStorage 或 sessionStorage 是否有登入紀錄
    const isLocalAdmin = localStorage.getItem('app_is_admin') === 'true';
    const isSessionAdmin = sessionStorage.getItem('app_is_admin') === 'true';
    if (isLocalAdmin || isSessionAdmin) setIsAdmin(true);
    
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#playlist/')) {
        setSharedPlaylistId(hash.split('/')[1]);
        setActiveTab('shared');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => { unsubscribe(); window.removeEventListener('hashchange', checkHash); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubVideos = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'videos'), orderBy('createdAt', 'desc')), 
      (snapshot) => setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    const unsubPlaylists = onSnapshot(query(collection(db, 'artifacts', appId, 'public', 'data', 'playlists'), orderBy('createdAt', 'desc')), 
      (snapshot) => setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );
    return () => { unsubVideos(); unsubPlaylists(); };
  }, [user]);

  useEffect(() => {
    if (sharedPlaylistId && user) {
      getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', sharedPlaylistId))
        .then(docSnap => {
          if (docSnap.exists()) setSharedPlaylistData({ id: docSnap.id, ...docSnap.data() });
          else { alert('找不到該播放清單'); setSharedPlaylistId(null); setActiveTab('home'); }
        }).catch(console.error);
    }
  }, [sharedPlaylistId, user]);

  const handleAdminLogin = (rememberMe) => {
    setIsAdmin(true);
    if (rememberMe) localStorage.setItem('app_is_admin', 'true');
    else sessionStorage.setItem('app_is_admin', 'true');
    if (activeTab === 'shared') setActiveTab('home');
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('app_is_admin');
    sessionStorage.removeItem('app_is_admin');
    setActiveTab('home');
  };

  // 標籤排序：依照字母/筆畫順序 (localeCompare)
  const allTags = useMemo(() => {
    const tags = new Set();
    videos.forEach(v => v.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'zh-TW')); 
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let source = videos;
    if (activeTab === 'shared' && sharedPlaylistData) source = videos.filter(v => sharedPlaylistData.videoIds.includes(v.id));
    else if (activeTab === 'shared' && !sharedPlaylistData) return [];
    
    return source.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag ? v.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    });
  }, [videos, searchQuery, selectedTag, activeTab, sharedPlaylistData]);
  
  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white p-4">正在連線至資料庫...</div>;
  if (!isAdmin && activeTab !== 'shared') return <LoginScreen onLogin={handleAdminLogin} />;

  const isSharedMode = activeTab === 'shared';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-10">
      <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer flex-shrink-0 mr-4" onClick={() => {
                if (!isSharedMode) { setActiveTab('home'); setSharedPlaylistId(null); setSearchQuery(''); setSelectedTag(null); window.location.hash = ''; }
              }}>
              <div className="bg-red-600 p-1.5 rounded-lg"><Film className="w-6 h-6 text-white" /></div>
              <span className="font-bold text-lg md:text-xl tracking-tight hidden xs:block">{isSharedMode ? (sharedPlaylistData?.title || '播放清單') : '影音平台'}</span>
            </div>

            {!isSharedMode && (
              <div className="flex-1 max-w-md mx-4 hidden md:block">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-full bg-gray-700 text-white focus:outline-none focus:border-red-500 sm:text-sm" placeholder="搜尋影片..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
            )}

            {!isSharedMode && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 md:overflow-visible">
                <button onClick={() => setActiveTab('home')} className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'home' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>影片庫</button>
                <button onClick={() => setActiveTab('playlists')} className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'playlists' ? 'bg-gray-900 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700'}`}>播放清單</button>
                <button onClick={() => { setVideoToEdit(null); setShowUploadModal(true); }} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-full text-sm font-medium flex items-center gap-2 whitespace-nowrap">
                  <Plus className="w-4 h-4" /><span className="hidden sm:inline">新增影片</span>
                </button>
                <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 ml-1 p-1"><LogOut className="w-5 h-5 md:w-6 md:h-6" /></button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'playlists' && !isSharedMode && (
          <PlaylistManager videos={videos} playlists={playlists} appId={appId} allTags={allTags} />
        )}

        {(activeTab === 'home' || activeTab === 'shared') && (
          <>
            {isSharedMode && sharedPlaylistData && (
                <div className="mb-8 bg-gray-800 rounded-xl border border-gray-700 p-6">
                   <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{sharedPlaylistData.title}</h1>
                   <div className="h-1 w-20 bg-red-600 rounded-full mb-4"></div>
                   <p className="text-gray-300 mb-4">{sharedPlaylistData.description}</p>
                   <div className="flex items-center gap-2 text-sm text-gray-500"><List className="w-4 h-4" /> 共 {filteredVideos.length} 部影片</div>
                </div>
            )}

            {!isSharedMode && allTags.length > 0 && (
              <div className="mb-6 overflow-x-auto no-scrollbar pb-2">
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTag(null)} className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${!selectedTag ? 'bg-white text-gray-900' : 'bg-gray-800 text-gray-400'}`}>全部</button>
                  {allTags.map(tag => (
                    <button key={tag} onClick={() => setSelectedTag(tag === selectedTag ? null : tag)} className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${tag === selectedTag ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400'}`}>#{tag}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredVideos.map(video => (
                <VideoCard key={video.id} video={video} onClick={() => setCurrentVideo(video)} isAdmin={isAdmin && !isSharedMode} onDelete={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', video.id)); }} onEdit={(e, v) => { e.stopPropagation(); setVideoToEdit(v); setShowUploadModal(true); }} />
              ))}
            </div>
          </>
        )}
      </main>
      
      {showUploadModal && <UploadModal onClose={() => { setShowUploadModal(false); setVideoToEdit(null); }} appId={appId} existingTags={allTags} videoToEdit={videoToEdit} db={db} />}
      {currentVideo && <PlayerModal video={currentVideo} onClose={() => setCurrentVideo(null)} />}
    </div>
  );
}

const VideoCard = ({ video, onClick, isAdmin, onDelete, onEdit }) => {
  const embedInfo = getEmbedInfo(video.url);
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer border border-gray-700 flex flex-col relative" onClick={onClick}>
      {isAdmin && (
        <div className="absolute top-2 left-2 z-20 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200">
          <button onClick={(e) => onEdit(e, video)} className="bg-gray-900/80 hover:bg-blue-600 text-white p-2 rounded-full shadow-md"><Pencil className="w-4 h-4" /></button>
          <button onClick={(e) => { if(confirm('確定刪除？')) onDelete(e, video.id); }} className="bg-gray-900/80 hover:bg-red-600 text-white p-2 rounded-full shadow-md"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      <div className="relative aspect-video bg-black overflow-hidden">
        <img src={video.thumbUrl || "https://placehold.co/600x400/000000/FFF?text=No+Thumbnail"} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"/>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100"><div className="bg-red-600 p-3 rounded-full"><Play className="w-8 h-8 text-white fill-current pl-1" /></div></div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <h3 className="text-lg font-semibold text-white line-clamp-2 mb-1">{video.title}</h3>
        <div className="flex flex-wrap gap-1 mb-2">
          {video.tags?.map(tag => <span key={tag} className="text-xs text-blue-300 bg-blue-900/30 px-1.5 py-0.5 rounded">#{tag}</span>)}
        </div>
      </div>
    </div>
  );
};

const PlayerModal = ({ video, onClose }) => {
  const embedInfo = getEmbedInfo(video.url);
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-0 md:p-4">
      <div className="w-full h-full md:h-auto md:max-h-[95vh] max-w-5xl bg-gray-900 md:rounded-xl overflow-hidden shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-3 border-b border-gray-800 shrink-0">
          <h2 className="text-lg font-bold text-white truncate pr-4">{video.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1"><X className="w-6 h-6" /></button>
        </div>
        <div className="relative bg-black w-full aspect-video flex items-center justify-center">
          {embedInfo?.type === 'native' ? (
             <video src={video.url} className="w-full h-full" controls autoPlay />
          ) : (
            <iframe width="100%" height="100%" src={embedInfo?.src} title="Player" frameBorder="0" allowFullScreen className="w-full h-full"></iframe>
          )}
        </div>
        <div className="p-4 bg-gray-900 border-t border-gray-800 overflow-y-auto flex-1">
            <h4 className="text-sm font-semibold text-gray-300 mb-1">影片說明</h4>
            <p className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{video.description || "無描述"}</p>
        </div>
      </div>
    </div>
  );
};

const UploadModal = ({ onClose, appId, existingTags, videoToEdit, db }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [thumbUrl, setThumbUrl] = useState('');
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (videoToEdit) {
      setTitle(videoToEdit.title || ''); setDesc(videoToEdit.description || '');
      setVideoUrl(videoToEdit.url || ''); setThumbUrl(videoToEdit.thumbUrl || '');
      setTags(videoToEdit.tags || []);
    }
  }, [videoToEdit]);

  // 網址變更即時抓取縮圖
  const handleUrlChange = (e) => {
    const newUrl = e.target.value;
    setVideoUrl(newUrl);
    const embedInfo = getEmbedInfo(newUrl);
    
    if (embedInfo?.type === 'youtube') {
      setThumbUrl(getYouTubeThumbnail(embedInfo.id));
    } else if (thumbUrl.includes('img.youtube.com')) {
      setThumbUrl(''); // 如果原本是 YT 縮圖但網址改了，就自動清空避免圖文不符
    }
  };

  const handleThumbUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setThumbUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { title, description: desc, url: videoUrl, thumbUrl, tags };
      if (videoToEdit) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'videos', videoToEdit.id), { ...payload, updatedAt: new Date().toISOString() });
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'videos'), { ...payload, createdAt: new Date().toISOString() });
      }
      onClose();
    } catch (error) { alert("儲存失敗：" + error.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-4">
      <div className="bg-gray-800 md:rounded-xl w-full h-full md:h-auto md:max-w-2xl p-4 md:p-6 border border-gray-700 overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {videoToEdit ? <Pencil className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-red-500" />} {videoToEdit ? '編輯影片' : '新增影片'}
          </h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-6 h-6" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">影片 URL</label>
                <input required type="url" value={videoUrl} onChange={handleUrlChange} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標題</label>
                <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">說明</label>
                <textarea rows="3" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"></textarea>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">封面圖</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700 relative overflow-hidden">
                  {thumbUrl ? <img src={thumbUrl} className="absolute inset-0 w-full h-full object-cover" /> : <div className="text-sm text-gray-400">點擊上傳</div>}
                  <input type="file" className="hidden" accept="image/*" onChange={handleThumbUpload} />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">標籤 (輸入後按 Enter)</label>
                <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); if(newTag && !tags.includes(newTag)) { setTags([...tags, newTag]); setNewTag(''); } } }} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white mb-2" />
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => <span key={tag} className="bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">{tag} <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}><X className="w-3 h-3" /></button></span>)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-400 mr-4">取消</button>
            <button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded">{loading ? '處理中...' : '儲存'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PlaylistManager = ({ videos, playlists, appId, allTags }) => {
  const [showCreate, setShowCreate] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null); // 紀錄目前編輯的清單 ID
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState([]);
  const [justCopied, setJustCopied] = useState(null);
  const [filterTag, setFilterTag] = useState(null);

  const openEditModal = (pl) => {
    setEditingPlaylistId(pl.id);
    setNewTitle(pl.title);
    setNewDesc(pl.description || '');
    setSelectedVideoIds(pl.videoIds || []);
    setShowCreate(true);
  };

  const closeEditModal = () => {
    setShowCreate(false);
    setEditingPlaylistId(null);
    setNewTitle('');
    setNewDesc('');
    setSelectedVideoIds([]);
  };

  const handleSavePlaylist = async () => {
    if (!newTitle || selectedVideoIds.length === 0) return;
    const db = getFirestore();
    try {
      if (editingPlaylistId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlists', editingPlaylistId), {
          title: newTitle, description: newDesc, videoIds: selectedVideoIds, updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'playlists'), {
          title: newTitle, description: newDesc, videoIds: selectedVideoIds, createdAt: new Date().toISOString()
        });
      }
      closeEditModal();
    } catch (e) { alert('儲存失敗'); }
  };

  const copyLink = (id) => {
    const link = `${window.location.origin}${window.location.pathname}#playlist/${id}`;
    navigator.clipboard.writeText(link).then(() => { setJustCopied(id); setTimeout(() => setJustCopied(null), 2000); });
  };

  const displayedVideos = videos.filter(v => filterTag ? v.tags?.includes(filterTag) : true);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">我的播放清單</h2>
        <button onClick={closeEditModal} onClickCapture={() => setShowCreate(true)} className="bg-green-600 px-3 py-2 rounded flex items-center gap-2"><Plus className="w-4 h-4" /> 建立新清單</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {playlists.map(pl => (
          <div key={pl.id} className="bg-gray-800 rounded-lg p-5 border border-gray-700 flex flex-col">
            <div className="flex justify-between mb-2">
              <h3 className="text-lg font-bold truncate">{pl.title}</h3>
              <div className="flex gap-2">
                 <button onClick={() => openEditModal(pl)} className="text-gray-400 hover:text-blue-400" title="編輯"><Pencil className="w-4 h-4" /></button>
                 <button onClick={() => { if(confirm('確定刪除清單？')) deleteDoc(doc(getFirestore(), 'artifacts', appId, 'public', 'data', 'playlists', pl.id)); }} className="text-gray-400 hover:text-red-400"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{pl.description || "無說明"}</p>
            <div className="mt-auto">
              <button onClick={() => copyLink(pl.id)} className="w-full py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm flex justify-center gap-2">
                {justCopied === pl.id ? <Check className="w-4 h-4"/> : <Share2 className="w-4 h-4"/>} 複製連結
              </button>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl w-full max-w-4xl p-6 border border-gray-700 max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold mb-4 shrink-0">{editingPlaylistId ? '編輯分享清單' : '建立分享清單'}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4 shrink-0">
                <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded px-3 py-2" placeholder="清單名稱" />
                <input type="text" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-gray-700 border-gray-600 rounded px-3 py-2" placeholder="清單說明 (選填)" />
            </div>

            <div className="flex-1 overflow-y-auto mb-4 border border-gray-700 bg-gray-900/50 p-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedVideos.map(v => (
                    <div key={v.id} onClick={() => setSelectedVideoIds(prev => prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id])}
                      className={`cursor-pointer p-3 rounded border flex items-center gap-3 ${selectedVideoIds.includes(v.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700'}`}>
                      <div className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center ${selectedVideoIds.includes(v.id) ? 'bg-blue-600' : 'border-gray-500'}`}>
                        {selectedVideoIds.includes(v.id) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="truncate text-sm">{v.title}</div>
                    </div>
                  ))}
               </div>
            </div>

            <div className="flex justify-end gap-3 shrink-0">
              <button onClick={closeEditModal} className="px-4 py-2 text-gray-400">取消</button>
              <button onClick={handleSavePlaylist} disabled={!newTitle || selectedVideoIds.length === 0} className="bg-blue-600 text-white px-6 py-2 rounded">
                 {editingPlaylistId ? '儲存變更' : '建立並儲存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};