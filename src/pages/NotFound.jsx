import { useEffect, useState } from "react";
import { t } from "../lib/ek-i18n";
import { useNavigate } from "react-router-dom";
import { LOGIN_URL, LOGO_URL } from "../config";

export default function NotFound() {
    const [seconds, setSeconds] = useState(10);
    const navigate = useNavigate();

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(s => {
                if (s <= 1) { clearInterval(interval); navigate("/"); }
                return s - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [navigate]);

    return (
        <>
            <style>{`
        .nf-body {
          font-family: 'DM Sans', sans-serif;
          color: white;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 120px);
          text-align: center;
          padding: 24px;
          border-radius: 18px;
          overflow: hidden;
          position: relative;
        }
        .nf-bg {
          position: absolute; inset: 0; z-index: 0;
          /* Tokenlar (C2): ilgari doim qora fon, ESKI brend ko'ki #017dca va
             dizayn tizimida yo'q Syne/DM Sans shriftlari edi — yorug' rejimda
             qora fon qoidasi ham buzilardi. */
          background:
            radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--bg-brand) 12%, transparent) 0%, transparent 60%),
            var(--bg-canvas);
        }
        .nf-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
          animation: nfFloat 10s ease-in-out infinite;
        }
        .nf-orb1 { width:500px; height:500px; background: color-mix(in srgb, var(--bg-brand) 10%, transparent); top:-150px; right:-100px; }
        .nf-orb2 { width:300px; height:300px; background: color-mix(in srgb, var(--bg-success) 8%, transparent); bottom:-50px; left:-50px; animation-delay:4s; }
        @keyframes nfFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-20px);} }

        .nf-content { position: relative; z-index: 1; max-width: 520px; color: var(--fg-primary); }

        .nf-num {
          font-family: var(--font-display);
          font-size: clamp(100px, 20vw, 160px);
          font-weight: 800; line-height: 1;
          background: linear-gradient(135deg, var(--bg-brand), var(--bg-success));
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
          animation: nfPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
          letter-spacing: -4px;
        }
        @keyframes nfPop { from{opacity:0;transform:scale(0.6);} to{opacity:1;transform:scale(1);} }

        .nf-icon { font-size: 56px; margin-bottom: 24px; animation: nfPop .6s cubic-bezier(0.34,1.56,0.64,1) .1s both; }

        .nf-title {
          font-family: var(--font-display);
          font-size: clamp(22px, 4vw, 32px); font-weight: 800;
          margin-bottom: 14px;
          animation: nfUp .5s ease .2s both;
        }
        .nf-desc {
          font-size: 16px; color: var(--fg-secondary);
          line-height: 1.7; margin-bottom: 40px;
          animation: nfUp .5s ease .3s both;
        }
        @keyframes nfUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }

        .nf-btns {
          display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
          animation: nfUp .5s ease .4s both;
        }
        .nf-btn-home {
          display: inline-flex; align-items: center; gap: 10px; min-height: 44px;
          background: var(--bg-brand); color: var(--fg-on-brand);
          padding: 13px 28px; border-radius: 10px;
          font-size: 15px; font-weight: 700; text-decoration: none;
          box-shadow: var(--sh-md);
          transition: transform .2s, box-shadow .2s; border: none; cursor: pointer;
          font-family: var(--font-sans);
        }
        .nf-btn-home:hover { transform: translateY(-2px); box-shadow: var(--sh-lg); }
        .nf-btn-back {
          display: inline-flex; align-items: center; gap: 10px; min-height: 44px;
          border: 1.5px solid var(--border-strong);
          color: var(--fg-primary); padding: 13px 28px; border-radius: 10px;
          font-size: 15px; font-weight: 600; background: none; cursor: pointer;
          transition: border-color .2s, background .2s;
          font-family: var(--font-sans);
        }
        .nf-btn-back:hover { border-color: var(--border-brand); background: var(--bg-brand-subtle); }

        .nf-countdown {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: var(--fg-secondary); margin-top: 24px;
          animation: nfUp .5s ease .6s both;
        }
        .nf-countdown span { color: var(--fg-brand); font-weight: 700; min-width: 18px; text-align: center; }

        .nf-quick { margin-top: 48px; padding-top: 32px; border-top: 1px solid var(--border-subtle); animation: nfUp .5s ease .5s both; }
        .nf-quick p { font-size: 12px; color: var(--fg-secondary); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
        .nf-quick-list { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .nf-quick-link {
          display: inline-flex; align-items: center; gap: 8px; min-height: 44px;
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          color: var(--fg-secondary); padding: 8px 16px; border-radius: 8px;
          font-size: 13px; text-decoration: none; transition: all .2s;
        }
        .nf-quick-link:hover { border-color: var(--border-brand); color: var(--fg-primary); background: var(--bg-brand-subtle); }
        .nf-quick-link i { font-size: 12px; color: var(--fg-brand); }
      `}</style>

            <div className="nf-body">
                <div className="nf-bg" />
                <div className="nf-orb nf-orb1" />
                <div className="nf-orb nf-orb2" />

                <div className="nf-content">
                    <div className="nf-num">404</div>
                    <div className="nf-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                    <h1 className="nf-title">{t("notFound.title")}</h1>
                    <p className="nf-desc">
                        Siz qidirayotgan sahifa köçirilgan, öçirilgan yoki heç qaçon mavjud bölmagan.
                        Iltimos, URLni tekşiring yoki boş sahifaga qayting.
                    </p>

                    <div className="nf-btns">
                        <button className="nf-btn-home" onClick={() => navigate("/")}>
                            <i className="fa-solid fa-house" /> Boş sahifa
                        </button>
                        <button className="nf-btn-back" onClick={() => window.history.back()}>
                            <i className="fa-solid fa-arrow-left" /> Orqaga
                        </button>
                    </div>

                    <div className="nf-countdown">
                        <i className="fa-solid fa-rotate-right" />
                        Avtomatik yönaltiriş: <span>{seconds}</span> soniyada
                    </div>

                    <div className="nf-quick">
                        <p>{t("notFound.usefulLinks")}</p>
                        <div className="nf-quick-list">
                            <a href="https://e-kassam.uz/#xususiyatlar" className="nf-quick-link">
                                <i className="fa-solid fa-star" /> Xususiyatlar
                            </a>
                            <a href="https://e-kassam.uz/#narx" className="nf-quick-link">
                                <i className="fa-solid fa-tag" /> Narxlar
                            </a>
                            <a href="https://e-kassam.uz/#aloqa" className="nf-quick-link">
                                <i className="fa-solid fa-envelope" /> Aloqa
                            </a>
                            <a href={LOGIN_URL} className="nf-quick-link">
                                <i className="fa-solid fa-arrow-right-to-bracket" /> Kiriş
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}