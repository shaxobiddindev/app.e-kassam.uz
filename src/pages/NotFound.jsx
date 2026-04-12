import { useEffect, useState } from "react";
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
          background: #0a0f1e;
          background:
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(1,125,202,0.15) 0%, transparent 60%),
            linear-gradient(160deg, #0a0f1e 0%, #0d1829 100%);
        }
        .nf-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none;
          animation: nfFloat 10s ease-in-out infinite;
        }
        .nf-orb1 { width:500px; height:500px; background:rgba(1,125,202,0.1); top:-150px; right:-100px; }
        .nf-orb2 { width:300px; height:300px; background:rgba(0,212,170,0.07); bottom:-50px; left:-50px; animation-delay:4s; }
        @keyframes nfFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-20px);} }

        .nf-content { position: relative; z-index: 1; max-width: 520px; }

        .nf-num {
          font-family: 'Syne', sans-serif;
          font-size: clamp(100px, 20vw, 160px);
          font-weight: 800; line-height: 1;
          background: linear-gradient(135deg, #017dca, #00d4aa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
          animation: nfPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
          letter-spacing: -4px;
        }
        @keyframes nfPop { from{opacity:0;transform:scale(0.6);} to{opacity:1;transform:scale(1);} }

        .nf-icon { font-size: 56px; margin-bottom: 24px; animation: nfPop .6s cubic-bezier(0.34,1.56,0.64,1) .1s both; }

        .nf-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(22px, 4vw, 32px); font-weight: 800;
          margin-bottom: 14px;
          animation: nfUp .5s ease .2s both;
        }
        .nf-desc {
          font-size: 16px; color: rgba(255,255,255,0.5);
          line-height: 1.7; margin-bottom: 40px;
          animation: nfUp .5s ease .3s both;
        }
        @keyframes nfUp { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }

        .nf-btns {
          display: flex; gap: 14px; justify-content: center; flex-wrap: wrap;
          animation: nfUp .5s ease .4s both;
        }
        .nf-btn-home {
          display: inline-flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, #017dca, #01368d);
          color: white; padding: 13px 28px; border-radius: 10px;
          font-size: 15px; font-weight: 700; text-decoration: none;
          box-shadow: 0 6px 24px rgba(1,125,202,0.4);
          transition: transform .2s, box-shadow .2s; border: none; cursor: pointer;
          font-family: 'DM Sans', sans-serif;
        }
        .nf-btn-home:hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(1,125,202,0.5); }
        .nf-btn-back {
          display: inline-flex; align-items: center; gap: 10px;
          border: 1.5px solid rgba(255,255,255,0.2);
          color: white; padding: 13px 28px; border-radius: 10px;
          font-size: 15px; font-weight: 600; background: none; cursor: pointer;
          transition: border-color .2s, background .2s;
          font-family: 'DM Sans', sans-serif;
        }
        .nf-btn-back:hover { border-color: #017dca; background: rgba(1,125,202,0.1); }

        .nf-countdown {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; color: rgba(255,255,255,0.35); margin-top: 24px;
          animation: nfUp .5s ease .6s both;
        }
        .nf-countdown span { color: #00d4aa; font-weight: 700; min-width: 18px; text-align: center; }

        .nf-quick { margin-top: 48px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.08); animation: nfUp .5s ease .5s both; }
        .nf-quick p { font-size: 12px; color: rgba(255,255,255,0.3); letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 16px; }
        .nf-quick-list { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .nf-quick-link {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.6); padding: 8px 16px; border-radius: 8px;
          font-size: 13px; text-decoration: none; transition: all .2s;
        }
        .nf-quick-link:hover { border-color: #017dca; color: white; background: rgba(1,125,202,0.1); }
        .nf-quick-link i { font-size: 12px; color: #00d4aa; }
      `}</style>

            <div className="nf-body">
                <div className="nf-bg" />
                <div className="nf-orb nf-orb1" />
                <div className="nf-orb nf-orb2" />

                <div className="nf-content">
                    <div className="nf-num">404</div>
                    <div className="nf-icon"><i className="fa-solid fa-magnifying-glass" /></div>
                    <h1 className="nf-title">Sahifa topilmadi</h1>
                    <p className="nf-desc">
                        Siz qidirayotgan sahifa ko'chirilgan, o'chirilgan yoki hech qachon mavjud bo'lmagan.
                        Iltimos, URLni tekshiring yoki bosh sahifaga qayting.
                    </p>

                    <div className="nf-btns">
                        <button className="nf-btn-home" onClick={() => navigate("/")}>
                            <i className="fa-solid fa-house" /> Bosh sahifa
                        </button>
                        <button className="nf-btn-back" onClick={() => window.history.back()}>
                            <i className="fa-solid fa-arrow-left" /> Orqaga
                        </button>
                    </div>

                    <div className="nf-countdown">
                        <i className="fa-solid fa-rotate-right" />
                        Avtomatik yo'naltirish: <span>{seconds}</span> soniyada
                    </div>

                    <div className="nf-quick">
                        <p>Foydali havolalar</p>
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
                                <i className="fa-solid fa-arrow-right-to-bracket" /> Kirish
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}