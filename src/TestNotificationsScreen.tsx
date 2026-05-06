import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

type NotificationType = 'success' | 'error';
type NotificationStyle = 'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6' | 'style7' | 'style8' | 'style9' | 'style10';

interface ShowingNotification {
  id: string;
  type: NotificationType;
  message: string;
  style: NotificationStyle;
}

export function TestNotificationsScreen() {
  const [notifications, setNotifications] = useState<ShowingNotification[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<NotificationStyle>('style1');

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const showAllStyles = (type: NotificationType) => {
    const styles: NotificationStyle[] = ['style1', 'style2', 'style3', 'style4', 'style5', 'style6', 'style7', 'style8', 'style9', 'style10'];
    const messages = {
      success: 'Operation completed successfully!',
      error: 'An error occurred. Please try again.',
    };

    styles.forEach((style, index) => {
      setTimeout(() => {
        const id = `${Date.now()}-${style}`;
        setNotifications((prev) => [...prev, { id, type, message: messages[type], style }]);

        setTimeout(() => {
          removeNotification(id);
        }, 5000);
      }, index * 600);
    });
  };

  const StyleCard = ({
    style,
    title,
    description,
  }: {
    style: NotificationStyle;
    title: string;
    description: string;
  }) => (
    <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>

      {selectedStyle === style && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 font-medium">
          ✓ Selected for application
        </div>
      )}
    </div>
  );

  return (
    <section className="bg-gray-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Notification Styles</h1>
          <p className="text-gray-600">Click a button below to preview all 5 notification styles</p>
        </div>

        {/* Main Control Buttons */}
        <div className="bg-white rounded-lg p-8 border border-gray-200 shadow-sm mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Preview Notifications</h2>
          <div className="flex gap-4">
            <button
              onClick={() => {
                showAllStyles('success');
                setSelectedStyle('style1');
              }}
              className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition shadow-md hover:shadow-lg"
            >
              Show Success
            </button>
            <button
              onClick={() => {
                showAllStyles('error');
                setSelectedStyle('style1');
              }}
              className="px-8 py-3 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition shadow-md hover:shadow-lg"
            >
              Show Failure
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Each style will appear in sequence. Click the button again to see them all again.
          </p>
        </div>

        {/* Selected Style Info */}
        {selectedStyle && (
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Currently selected: <span className="font-bold capitalize">{selectedStyle.replace('style', 'Style ')}</span>
            </p>
          </div>
        )}

        {/* Grid of Style Descriptions */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Styles (10 Options)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StyleCard
              style="style1"
              title="Style 1: Slide Top-Right"
              description="Classic slide-in from top-right corner with smooth fade animation. Clean and minimal design."
            />
            <StyleCard
              style="style2"
              title="Style 2: Slide Top-Center"
              description="Centered notification sliding from top with full-width shadow. Great for prominent alerts."
            />
            <StyleCard
              style="style3"
              title="Style 3: Bounce Animation"
              description="Bouncy entrance with spring effect. More playful and attention-grabbing animation."
            />
            <StyleCard
              style="style4"
              title="Style 4: Glassmorphism"
              description="Modern glassmorphism with backdrop blur effect. Contemporary and sophisticated look."
            />
            <StyleCard
              style="style5"
              title="Style 5: Minimalist Bottom"
              description="Subtle slide from bottom corner with small footprint. Unobtrusive and elegant."
            />
            <StyleCard
              style="style6"
              title="Style 6: Slide Left"
              description="Slides in from left side with rotation animation. Dynamic and modern appearance."
            />
            <StyleCard
              style="style7"
              title="Style 7: Zoom In"
              description="Scales up smoothly with fade effect. Energetic and attention-grabbing animation."
            />
            <StyleCard
              style="style8"
              title="Style 8: Material Design"
              description="Google Material Design inspired with shadow elevation. Professional and clean."
            />
            <StyleCard
              style="style9"
              title="Style 9: Expandable Card"
              description="Expands from a small point with shadow. Modern card-based notification style."
            />
            <StyleCard
              style="style10"
              title="Style 10: Floating Badge"
              description="Compact floating badge with subtle animation. Perfect for non-intrusive notifications."
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Apply Selected Style</h3>
          <p className="text-sm text-gray-600 mb-6">
            Once you've identified your preferred notification style, click below to apply it throughout the application.
          </p>
          <button
            onClick={() => {
              alert(`✓ Style ${selectedStyle.replace('style', 'Style ')} will be applied to the entire application!\n\nNotification styling will be updated globally.`);
            }}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-md hover:shadow-lg"
          >
            Apply {selectedStyle.replace('style', 'Style ')} to Application
          </button>
        </div>
      </div>

      {/* Notifications Container */}
      <div className="fixed inset-0 pointer-events-none">
        {notifications.map((notif) => (
          <Notification key={notif.id} notification={notif} onClose={() => removeNotification(notif.id)} />
        ))}
      </div>
    </section>
  );
}

function Notification({ notification, onClose }: { notification: ShowingNotification; onClose: () => void }) {
  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <XCircle size={20} />,
  };

  const colors = {
    success: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-800',
      icon: 'text-emerald-600',
      button: 'hover:bg-emerald-100',
    },
    error: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-800',
      icon: 'text-rose-600',
      button: 'hover:bg-rose-100',
    },
  };

  const c = colors[notification.type];
  const style = notification.style;

  // Style 1: Slide Top-Right
  if (style === 'style1') {
    return (
      <div
        className={`fixed top-4 right-4 min-w-[300px] max-w-[420px] pointer-events-auto animate-slide-in-right`}
        style={{
          animation: 'slideInRight 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border ${c.border} rounded-lg p-4 shadow-lg`}>
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5`}>{icons[notification.type]}</div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${c.text}`}>{notification.message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 2: Slide Top-Center
  if (style === 'style2') {
    return (
      <div
        className="fixed top-0 left-1/2 w-full max-w-md pointer-events-auto -translate-x-1/2 pt-4"
        style={{
          animation: 'slideInDown 0.4s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInDown {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border ${c.border} rounded-lg p-4 shadow-2xl mx-4`}>
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5`}>{icons[notification.type]}</div>
            <div className="flex-1">
              <p className={`text-sm font-medium ${c.text}`}>{notification.message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 3: Bounce Animation
  if (style === 'style3') {
    return (
      <div
        className="fixed top-4 right-4 min-w-[300px] max-w-[420px] pointer-events-auto"
        style={{
          animation: 'bounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        }}
      >
        <style>{`
          @keyframes bounce {
            0% {
              transform: translate(400px, -100px) scale(0.8);
              opacity: 0;
            }
            50% {
              transform: translateX(-10px);
            }
            100% {
              transform: translate(0, 0) scale(1);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border-2 ${c.border} rounded-xl p-4 shadow-2xl`}>
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5 text-xl`}>{icons[notification.type]}</div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${c.text}`}>{notification.message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 4: Glassmorphism
  if (style === 'style4') {
    return (
      <div
        className="fixed top-4 right-4 min-w-[300px] max-w-[420px] pointer-events-auto"
        style={{
          animation: 'slideInRight 0.5s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from {
              transform: translateX(400px);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
        <div
          className={`${c.bg} border ${c.border} rounded-xl p-4 shadow-2xl backdrop-blur-md`}
          style={{
            background: c.bg.includes('emerald')
              ? 'rgba(16, 185, 129, 0.1)'
              : c.bg.includes('rose')
                ? 'rgba(244, 63, 94, 0.1)'
                : 'rgba(217, 119, 6, 0.1)',
            backdropFilter: 'blur(10px)',
            borderColor: c.bg.includes('emerald')
              ? 'rgba(16, 185, 129, 0.3)'
              : c.bg.includes('rose')
                ? 'rgba(244, 63, 94, 0.3)'
                : 'rgba(217, 119, 6, 0.3)',
          }}
        >
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5 text-xl`}>{icons[notification.type]}</div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${c.text}`}>{notification.message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 5: Minimalist Bottom
  if (style === 'style5') {
    return (
      <div
        className="fixed bottom-4 left-4 max-w-sm pointer-events-auto"
        style={{
          animation: 'slideInUp 0.4s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInUp {
            from {
              transform: translateY(100px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border ${c.border} rounded-lg p-3 shadow-md`}>
          <div className="flex items-center gap-2">
            <div className={`${c.icon} flex-shrink-0`}>{icons[notification.type]}</div>
            <p className={`text-xs font-medium ${c.text} flex-1`}>{notification.message}</p>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-0.5 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 6: Slide Left
  if (style === 'style6') {
    return (
      <div
        className="fixed top-4 left-4 min-w-[300px] max-w-[420px] pointer-events-auto"
        style={{
          animation: 'slideInLeft 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <style>{`
          @keyframes slideInLeft {
            from {
              transform: translateX(-400px) rotateY(90deg);
              opacity: 0;
            }
            to {
              transform: translateX(0) rotateY(0deg);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border-2 ${c.border} rounded-xl p-4 shadow-2xl`}>
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5 text-xl`}>{icons[notification.type]}</div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${c.text}`}>{notification.message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 7: Zoom In
  if (style === 'style7') {
    return (
      <div
        className="fixed top-4 right-4 min-w-[300px] max-w-[420px] pointer-events-auto"
        style={{
          animation: 'zoomIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <style>{`
          @keyframes zoomIn {
            from {
              transform: scale(0) rotate(-180deg);
              opacity: 0;
            }
            to {
              transform: scale(1) rotate(0deg);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border-2 ${c.border} rounded-2xl p-4 shadow-2xl`}>
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5 text-2xl`}>{icons[notification.type]}</div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${c.text}`}>{notification.message}</p>
            </div>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 8: Material Design
  if (style === 'style8') {
    return (
      <div
        className="fixed bottom-4 right-4 min-w-[280px] max-w-[400px] pointer-events-auto"
        style={{
          animation: 'slideInUp 0.3s ease-out',
        }}
      >
        <style>{`
          @keyframes slideInUp {
            from {
              transform: translateY(100px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} ${c.border} rounded-lg p-4`} style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          <div className="flex items-start gap-3">
            <div className={`${c.icon} flex-shrink-0 mt-0.5 text-lg`}>{icons[notification.type]}</div>
            <p className={`text-sm font-medium ${c.text} flex-1`}>{notification.message}</p>
            <button
              onClick={onClose}
              className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ${c.button} rounded p-1 transition`}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Style 9: Expandable Card
  if (style === 'style9') {
    return (
      <div
        className="fixed top-1/2 left-1/2 pointer-events-auto"
        style={{
          transform: 'translate(-50%, -50%)',
          animation: 'expandCard 0.5s ease-out',
        }}
      >
        <style>{`
          @keyframes expandCard {
            from {
              transform: translate(-50%, -50%) scale(0);
              opacity: 0;
            }
            to {
              transform: translate(-50%, -50%) scale(1);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} border-2 ${c.border} rounded-3xl p-6 shadow-2xl min-w-[350px] text-center`}>
          <div className={`${c.icon} flex justify-center mb-3`} style={{ fontSize: '32px' }}>
            {icons[notification.type]}
          </div>
          <p className={`text-sm font-bold ${c.text} mb-4`}>{notification.message}</p>
          <button
            onClick={onClose}
            className={`text-xs font-medium ${c.text} px-4 py-2 rounded-lg ${c.bg} border ${c.border} hover:opacity-80 transition`}
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Style 10: Floating Badge
  if (style === 'style10') {
    return (
      <div
        className="fixed top-6 right-6 pointer-events-auto"
        style={{
          animation: 'floatIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <style>{`
          @keyframes floatIn {
            from {
              transform: translateY(-50px) scale(0.5);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }
        `}</style>
        <div className={`${c.bg} ${c.border} rounded-full px-4 py-3 shadow-lg flex items-center gap-2`}>
          <div className={`${c.icon} flex-shrink-0`}>{icons[notification.type]}</div>
          <span className={`text-xs font-semibold ${c.text} whitespace-nowrap`}>{notification.message.split('.')[0]}</span>
          <button
            onClick={onClose}
            className={`flex-shrink-0 text-gray-400 hover:text-gray-600 ml-2 transition`}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return null;
}
