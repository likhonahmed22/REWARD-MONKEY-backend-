// telegram-mini-app/src/App.jsx
// COPY THIS ENTIRE FILE

import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ⚠️ CHANGE THIS TO YOUR BACKEND URL FROM VERCEL
const API_URL = 'https://your-api-url.vercel.app';

const tg = window.Telegram?.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('earn');
  const [adSession, setAdSession] = useState(null);
  const [timer, setTimer] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [dailyStats, setDailyStats] = useState({ ads_watched: 0, total_earned_today: 0 });

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
    }
    authenticateUser();
  }, []);

  const authenticateUser = async () => {
    try {
      let telegramId = null;
      let username = null;

      if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        telegramId = tg.initDataUnsafe.user.id;
        username = tg.initDataUnsafe.user.username;
      }

      // Fallback to device ID if Telegram not available
      if (!telegramId) {
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('device_id', deviceId);
        }

        const response = await axios.post(`${API_URL}/api/auth/device`, {
          device_id: deviceId
        });

        localStorage.setItem('token', response.data.token);
        setUser(response.data.user);
        setLoading(false);
        return;
      }

      // Telegram authentication
      const response = await axios.post(`${API_URL}/api/auth/telegram`, {
        telegram_id: telegramId,
        username: username
      });

      localStorage.setItem('token', response.data.token);
      setUser(response.data.user);
      setLoading(false);
      refreshProfile();
    } catch (err) {
      console.error('Auth error:', err);
      alert('Authentication failed. Please try again.');
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
      setDailyStats(response.data.daily_stats);
    } catch (err) {
      console.error('Refresh error:', err);
    }
  };

  const startAd = async (duration) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/ads/start`,
        { duration },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAdSession(response.data);
      setTimer(duration);

      // Start countdown timer
      let remaining = duration;
      const interval = setInterval(() => {
        remaining--;
        setTimer(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
          completeAd(response.data);
        }
      }, 1000);
    } catch (err) {
      if (err.response?.status === 429) {
        alert(err.response.data.error);
      } else {
        alert('Failed to load ad. Please try again.');
      }
    }
  };

  const completeAd = async (session) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/ads/complete`,
        {
          session_token: session.session_token,
          ad_view_id: session.ad_view_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAdSession(null);
      setTimer(0);
      
      setUser(prev => ({
        ...prev,
        wallet_balance: response.data.new_balance
      }));

      alert(`✅ Earned ${response.data.reward} BDT!`);
      refreshProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to claim reward');
      setAdSession(null);
      setTimer(0);
    }
  };

  const loadTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/user/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTransactions(response.data);
    } catch (err) {
      console.error('Load transactions error:', err);
    }
  };

  const requestWithdrawal = async () => {
    const amount = prompt('Enter amount (min 300 BDT):');
    if (!amount || parseFloat(amount) < 300) {
      alert('Minimum withdrawal is 300 BDT');
      return;
    }

    const method = confirm('bKash? (OK for bKash, Cancel for Nagad)') ? 'bkash' : 'nagad';
    const accountNumber = prompt(`Enter your ${method} number:`);

    if (!accountNumber) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/withdrawals/request`,
        { 
          amount: parseFloat(amount), 
          payment_method: method, 
          account_number: accountNumber 
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert('Withdrawal request submitted! Admin will review shortly.');
      refreshProfile();
    } catch (err) {
      alert(err.response?.data?.error || 'Withdrawal failed');
    }
  };

  const shareReferral = () => {
    const referralCode = user?.referral_code;
    const botUsername = 'YourBotUsername'; // Change this to your bot username
    const referralLink = `https://t.me/${botUsername}?start=${referralCode}`;
    const text = `🎁 Join Reward Money and earn BDT by watching ads! Use my referral code: ${referralCode}

${referralLink}`;
    
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`);
    } else {
      // Fallback for web
      navigator.clipboard.writeText(text);
      alert('Referral link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loader}>
          <div style={styles.spinner}></div>
          <p style={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>💰 Reward Money</h1>
        <div style={styles.balance}>
          <span style={styles.balanceLabel}>Balance:</span>
          <span style={styles.balanceAmount}>{parseFloat(user?.wallet_balance || 0).toFixed(2)} BDT</span>
        </div>
      </div>

      <div style={styles.nav}>
        {['earn', 'wallet', 'referral'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              if (tab === 'wallet') loadTransactions();
            }}
            style={{
              ...styles.navButton,
              ...(activeTab === tab ? styles.navButtonActive : {})
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'earn' && (
          <div>
            <h2 style={styles.sectionTitle}>Watch Ads & Earn</h2>
            
            <div style={styles.dailyInfo}>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Today's Ads:</span>
                <span style={styles.infoValue}>{dailyStats.ads_watched}/30</span>
              </div>
              <div style={styles.infoItem}>
                <span style={styles.infoLabel}>Today's Earning:</span>
                <span style={styles.infoValue}>{parseFloat(dailyStats.total_earned_today || 0).toFixed(2)}/10 BDT</span>
              </div>
            </div>
            
            {adSession ? (
              <div style={styles.adPlayer}>
                <div style={styles.adTimer}>
                  <div style={styles.timerCircle}>
                    <span style={styles.timerText}>{timer}s</span>
                  </div>
                  <p style={styles.adMessage}>Watching ad... Please wait</p>
                  <div style={styles.progressBar}>
                    <div 
                      style={{
                        ...styles.progressFill,
                        width: `${((adSession.duration - timer) / adSession.duration) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.adGrid}>
                <AdCard duration={15} reward={0.10} onStart={startAd} />
                <AdCard duration={30} reward={0.30} onStart={startAd} />
                <AdCard duration={45} reward={0.50} onStart={startAd} />
              </div>
            )}

            <div style={styles.stats}>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>Total Earned</span>
                <span style={styles.statValue}>{parseFloat(user?.total_earned || 0).toFixed(2)} BDT</span>
              </div>
              <div style={styles.statBox}>
                <span style={styles.statLabel}>Referrals</span>
                <span style={styles.statValue}>{user?.total_referrals || 0}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div>
            <h2 style={styles.sectionTitle}>Your Wallet</h2>
            
            <div style={styles.walletCard}>
              <p style={styles.walletBalance}>{parseFloat(user?.wallet_balance || 0).toFixed(2)} BDT</p>
              <p style={styles.walletLabel}>Available Balance</p>
              <button 
                onClick={requestWithdrawal} 
                style={{
                  ...styles.withdrawButton,
                  opacity: parseFloat(user?.wallet_balance || 0) < 300 ? 0.5 : 1
                }}
                disabled={parseFloat(user?.wallet_balance || 0) < 300}
              >
                Withdraw (Min 300 BDT)
              </button>
            </div>

            <h3 style={styles.subsectionTitle}>Recent Transactions</h3>
            <div style={styles.transactionList}>
              {transactions.length === 0 ? (
                <p style={styles.emptyState}>No transactions yet</p>
              ) : (
                transactions.map(tx => (
                  <div key={tx.id} style={styles.transactionItem}>
                    <div>
                      <p style={styles.txType}>{tx.description}</p>
                      <p style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString()}</p>
                    </div>
                    <span style={styles.txAmount}>+{parseFloat(tx.amount).toFixed(2)} BDT</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'referral' && (
          <div>
            <h2 style={styles.sectionTitle}>Refer & Earn</h2>
            
            <div style={styles.referralCard}>
              <p style={styles.referralBonus}>3 BDT per Referral</p>
              <p style={styles.referralCode}>Your Code: {user?.referral_code}</p>
              <button onClick={shareReferral} style={styles.shareButton}>
                📤 Share Referral Link
              </button>
            </div>

            <div style={styles.infoBox}>
              <h3 style={styles.infoTitle}>How it works:</h3>
              <ul style={styles.infoList}>
                <li>Share your unique referral code</li>
                <li>Friend signs up using your code</li>
                <li>You earn 3 BDT instantly</li>
                <li>No limit on referrals!</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const AdCard = ({ duration, reward, onStart }) => (
  <div style={styles.adCard}>
    <div style={styles.adIcon}>🎬</div>
    <p style={styles.adDuration}>{duration}s Ad</p>
    <p style={styles.adReward}>+{reward} BDT</p>
    <button onClick={() => onStart(duration)} style={styles.adButton}>
      Watch Now
    </button>
  </div>
);

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#0f0f0f',
    color: '#fff',
    minHeight: '100vh',
    paddingBottom: 20
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px 16px',
    textAlign: 'center'
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontWeight: 'bold'
  },
  balance: {
    marginTop: 10,
    fontSize: 14
  },
  balanceLabel: {
    opacity: 0.8,
    marginRight: 8
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ade80'
  },
  nav: {
    display: 'flex',
    borderBottom: '1px solid #333',
    backgroundColor: '#1a1a1a'
  },
  navButton: {
    flex: 1,
    padding: '12px 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#999',
    fontSize: 14,
    cursor: 'pointer'
  },
  navButtonActive: {
    color: '#fff',
    borderBottom: '2px solid #667eea'
  },
  content: {
    padding: 16
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 16,
    fontWeight: 'bold'
  },
  dailyInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    display: 'flex',
    justifyContent: 'space-around'
  },
  infoItem: {
    textAlign: 'center'
  },
  infoLabel: {
    display: 'block',
    fontSize: 12,
    color: '#999',
    marginBottom: 4
  },
  infoValue: {
    display: 'block',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80'
  },
  adGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: 12,
    marginBottom: 20
  },
  adCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center',
    border: '1px solid #333'
  },
  adIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  adDuration: {
    fontSize: 14,
    color: '#999',
    margin: '4px 0'
  },
  adReward: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4ade80',
    margin: '8px 0'
  },
  adButton: {
    width: '100%',
    padding: '8px 0',
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  adPlayer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 32,
    textAlign: 'center',
    minHeight: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  adTimer: {
    textAlign: 'center',
    width: '100%'
  },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    backgroundColor: '#667eea',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px'
  },
  timerText: {
    fontSize: 32,
    fontWeight: 'bold'
  },
  adMessage: {
    color: '#999',
    fontSize: 14,
    marginBottom: 16
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    transition: 'width 1s linear'
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
    marginTop: 20
  },
  statBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    textAlign: 'center'
  },
  statLabel: {
    display: 'block',
    color: '#999',
    fontSize: 12,
    marginBottom: 4
  },
  statValue: {
    display: 'block',
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ade80'
  },
  walletCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
    marginBottom: 20
  },
  walletBalance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4ade80',
    margin: 0
  },
  walletLabel: {
    color: '#999',
    fontSize: 14,
    marginTop: 4
  },
  withdrawButton: {
    marginTop: 16,
    padding: '12px 24px',
    backgroundColor: '#4ade80',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  subsectionTitle: {
    fontSize: 16,
    marginBottom: 12,
    color: '#999'
  },
  transactionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8
  },
  transactionItem: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  txType: {
    fontSize: 14,
    margin: 0
  },
  txDate: {
    fontSize: 12,
    color: '#999',
    margin: '4px 0 0'
  },
  txAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ade80'
  },
  emptyState: {
    textAlign: 'center',
    color: '#999',
    padding: 32
  },
  referralCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
    marginBottom: 20
  },
  referralBonus: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4ade80',
    margin: '0 0 8px'
  },
  referralCode: {
    fontSize: 20,
    fontFamily: 'monospace',
    color: '#667eea',
    margin: '8px 0 16px'
  },
  shareButton: {
    padding: '12px 24px',
    backgroundColor: '#667eea',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16
  },
  infoTitle: {
    fontSize: 16,
    marginBottom: 12
  },
  infoList: {
    color: '#999',
    fontSize: 14,
    lineHeight: 1.8,
    paddingLeft: 20
  },
  loader: {
    textAlign: 'center',
    padding: 50
  },
  spinner: {
    width: 50,
    height: 50,
    border: '4px solid #333',
    borderTop: '4px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 20px'
  },
  loadingText: {
    fontSize: 18,
    color: '#999'
  }
};

// Add keyframe animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default App;
