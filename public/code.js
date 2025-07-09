;(() => {
const app = document.querySelector(".app")
let currentUser = ""
let socket
let isConnected = false
let soundEnabled = true
let replyingTo = null

// Voice recording variables
let mediaRecorder = null
let audioChunks = []
let isRecording = false
let recordingStartTime = 0
let recordingTimer = null

console.log("JavaScript loaded")

// Touch/swipe handling for mobile
let touchStartX = 0
let touchStartY = 0
let isSwiping = false
let touchTarget = null

// Sound functions
function createNotificationSound() {
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const oscillator = audioContext.createOscillator()
const gainNode = audioContext.createGain()

oscillator.connect(gainNode)
gainNode.connect(audioContext.destination)

oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

oscillator.start(audioContext.currentTime)
oscillator.stop(audioContext.currentTime + 0.3)
}

function createMessageSentSound() {
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const oscillator = audioContext.createOscillator()
const gainNode = audioContext.createGain()

oscillator.connect(gainNode)
gainNode.connect(audioContext.destination)

oscillator.frequency.setValueAtTime(400, audioContext.currentTime)
oscillator.frequency.setValueAtTime(500, audioContext.currentTime + 0.05)

gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

oscillator.start(audioContext.currentTime)
oscillator.stop(audioContext.currentTime + 0.1)
}

function createUserJoinSound() {
const audioContext = new (window.AudioContext || window.webkitAudioContext)()
const oscillator = audioContext.createOscillator()
const gainNode = audioContext.createGain()

oscillator.connect(gainNode)
gainNode.connect(audioContext.destination)

oscillator.frequency.setValueAtTime(500, audioContext.currentTime)
oscillator.frequency.setValueAtTime(700, audioContext.currentTime + 0.1)
oscillator.frequency.setValueAtTime(900, audioContext.currentTime + 0.2)

gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

oscillator.start(audioContext.currentTime)
oscillator.stop(audioContext.currentTime + 0.3)
}

function playNotificationSound() {
if (!soundEnabled) return
try {
  createNotificationSound()
} catch (error) {
  console.log("Could not play notification sound:", error)
}
}

function playMessageSentSound() {
if (!soundEnabled) return
try {
  createMessageSentSound()
} catch (error) {
  console.log("Could not play sent sound:", error)
}
}

function playUserJoinSound() {
if (!soundEnabled) return
try {
  createUserJoinSound()
} catch (error) {
  console.log("Could not play join sound:", error)
}
}

function toggleSound() {
soundEnabled = !soundEnabled
const soundBtn = document.querySelector("#sound-toggle")
if (soundBtn) {
  soundBtn.textContent = soundEnabled ? "🔊" : "🔇"
  soundBtn.title = soundEnabled ? "Sound On" : "Sound Off"
}
localStorage.setItem("chatSoundEnabled", soundEnabled)
if (soundEnabled) {
  playNotificationSound()
}
}

function loadSoundPreference() {
const saved = localStorage.getItem("chatSoundEnabled")
if (saved !== null) {
  soundEnabled = saved === "true"
}
}

// Voice recording functions
async function startVoiceRecording() {
try {
  console.log("Starting voice recording...")
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 44100,
    },
  })

  mediaRecorder = new MediaRecorder(stream, {
    mimeType: "audio/webm;codecs=opus",
  })

  audioChunks = []
  isRecording = true
  recordingStartTime = Date.now()

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data)
    }
  }

  mediaRecorder.onstop = () => {
    console.log("Recording stopped")
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" })
    sendVoiceMessage(audioBlob)
    // Stop all tracks to release microphone
    stream.getTracks().forEach((track) => track.stop())
  }

  mediaRecorder.start()
  updateVoiceButton(true)
  startRecordingTimer()

  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate(50)
  }
} catch (error) {
  console.error("Error starting voice recording:", error)
  showMessage("Microphone access denied or not available", "error")
}
}

function stopVoiceRecording() {
if (mediaRecorder && isRecording) {
  console.log("Stopping voice recording...")
  mediaRecorder.stop()
  isRecording = false
  updateVoiceButton(false)
  stopRecordingTimer()

  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate([50, 50, 50])
  }
}
}

function startRecordingTimer() {
const voiceBtn = document.querySelector("#voice-btn")
const timerDisplay = document.querySelector("#recording-timer")

recordingTimer = setInterval(() => {
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  if (timerDisplay) {
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Auto-stop after 5 minutes
  if (elapsed >= 300) {
    stopVoiceRecording()
  }
}, 1000)
}

function stopRecordingTimer() {
if (recordingTimer) {
  clearInterval(recordingTimer)
  recordingTimer = null
}
const timerDisplay = document.querySelector("#recording-timer")
if (timerDisplay) {
  timerDisplay.textContent = ""
}
}

function updateVoiceButton(recording) {
const voiceBtn = document.querySelector("#voice-btn")
const sendBtn = document.querySelector("#send-message")
const messageInput = document.querySelector("#message-input")

if (recording) {
  voiceBtn.innerHTML = "⏹️"
  voiceBtn.title = "Stop Recording"
  voiceBtn.style.background = "#ef4444"
  voiceBtn.style.animation = "pulse 1s infinite"
  sendBtn.style.display = "none"
  messageInput.placeholder = "Recording voice message..."
  messageInput.disabled = true

  // Add recording timer display
  if (!document.querySelector("#recording-timer")) {
    const timer = document.createElement("div")
    timer.id = "recording-timer"
    timer.style.cssText = `
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      background: #ef4444;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    `
    voiceBtn.style.position = "relative"
    voiceBtn.appendChild(timer)
  }
} else {
  voiceBtn.innerHTML = "🎤"
  voiceBtn.title = "Record Voice Message"
  voiceBtn.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
  voiceBtn.style.animation = "none"
  sendBtn.style.display = "block"
  messageInput.placeholder = "Type your message..."
  messageInput.disabled = false

  // Remove recording timer
  const timer = document.querySelector("#recording-timer")
  if (timer) {
    timer.remove()
  }
}
}

async function sendVoiceMessage(audioBlob) {
if (!currentUser) {
  showMessage("Please sign in first", "error")
  return
}

console.log("Sending voice message, size:", audioBlob.size)

// Convert blob to base64
const reader = new FileReader()
reader.onload = () => {
  const base64Audio = reader.result.split(",")[1]
  const duration = Math.floor((Date.now() - recordingStartTime) / 1000)

  const voiceMessageData = {
    username: currentUser,
    type: "voice",
    audioData: base64Audio,
    duration: duration,
    replyTo: replyingTo
      ? {
          username: replyingTo.username,
          text: replyingTo.text,
          id: replyingTo.id,
        }
      : null,
    id: Date.now() + Math.random(),
  }

  renderMessage("my", voiceMessageData)
  playMessageSentSound()

  if (socket && isConnected) {
    socket.emit("chat", voiceMessageData)
  } else {
    renderMessage("update", { text: "Voice message not sent - disconnected from server" })
  }

  clearReply()
}
reader.readAsDataURL(audioBlob)
}

function createAudioPlayer(audioData, duration, messageId) {
const audioContainer = document.createElement("div")
audioContainer.className = "voice-message-container"
audioContainer.innerHTML = `
  <div class="voice-controls">
    <button class="play-pause-btn" data-message-id="${messageId}">▶️</button>
    <div class="voice-progress">
      <div class="voice-progress-bar" data-message-id="${messageId}"></div>
    </div>
    <span class="voice-duration">${formatDuration(duration)}</span>
  </div>
`

// Create audio element
const audio = document.createElement("audio")
audio.src = `data:audio/webm;base64,${audioData}`
audio.preload = "metadata"

const playBtn = audioContainer.querySelector(".play-pause-btn")
const progressBar = audioContainer.querySelector(".voice-progress-bar")
const durationSpan = audioContainer.querySelector(".voice-duration")

let isPlaying = false

playBtn.addEventListener("click", () => {
  if (isPlaying) {
    audio.pause()
    playBtn.textContent = "▶️"
    isPlaying = false
  } else {
    // Pause all other playing audio
    document.querySelectorAll("audio").forEach((otherAudio) => {
      if (otherAudio !== audio) {
        otherAudio.pause()
      }
    })
    document.querySelectorAll(".play-pause-btn").forEach((btn) => {
      if (btn !== playBtn) {
        btn.textContent = "▶️"
      }
    })
    audio.play()
    playBtn.textContent = "⏸️"
    isPlaying = true
  }
})

audio.addEventListener("timeupdate", () => {
  const progress = (audio.currentTime / audio.duration) * 100
  progressBar.style.width = `${progress}%`
  const remaining = audio.duration - audio.currentTime
  durationSpan.textContent = formatDuration(Math.ceil(remaining))
})

audio.addEventListener("ended", () => {
  playBtn.textContent = "▶️"
  progressBar.style.width = "0%"
  durationSpan.textContent = formatDuration(duration)
  isPlaying = false
})

audio.addEventListener("pause", () => {
  playBtn.textContent = "▶️"
  isPlaying = false
})

return audioContainer
}

function formatDuration(seconds) {
const mins = Math.floor(seconds / 60)
const secs = seconds % 60
return `${mins}:${secs.toString().padStart(2, "0")}`
}

// Reply functionality
function setReplyTo(messageData) {
console.log("Setting reply to:", messageData)
replyingTo = messageData
showReplyPreview()

// Focus input and provide haptic feedback on mobile
const messageInput = document.querySelector("#message-input")
messageInput.focus()

// Haptic feedback for mobile devices
if (navigator.vibrate) {
  navigator.vibrate(50)
}

// Show success message briefly
const tempMessage = document.createElement("div")
tempMessage.textContent = `Replying to ${messageData.username}`
tempMessage.style.cssText = `
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #667eea;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  z-index: 1000;
  animation: fadeInOut 1.5s ease;
`
document.body.appendChild(tempMessage)
setTimeout(() => {
  if (tempMessage.parentNode) {
    tempMessage.remove()
  }
}, 1500)
}

function showReplyPreview() {
if (!replyingTo) return

const existingPreview = document.querySelector(".reply-preview")
if (existingPreview) {
  existingPreview.remove()
}

const replyPreview = document.createElement("div")
replyPreview.className = "reply-preview"

const replyText = replyingTo.type === "voice" ? `🎤 Voice message (${replyingTo.duration}s)` : replyingTo.text

replyPreview.innerHTML = `
        <div class="reply-content">
            <div class="reply-to">Replying to ${replyingTo.username}</div>
            <div class="reply-text">${replyText}</div>
        </div>
        <button class="close-reply" onclick="clearReply()">×</button>
    `

const typebox = document.querySelector(".typebox")
typebox.parentNode.insertBefore(replyPreview, typebox)
typebox.classList.add("reply-mode")
}

function clearReply() {
console.log("Clearing reply")
replyingTo = null
const replyPreview = document.querySelector(".reply-preview")
if (replyPreview) {
  replyPreview.remove()
}
const typebox = document.querySelector(".typebox")
if (typebox) {
  typebox.classList.remove("reply-mode")
}
}

window.clearReply = clearReply

function addMessageInteractions(messageElement, messageData) {
console.log("Adding interactions to message:", messageData)

// Make message clickable with better visual feedback
messageElement.style.cursor = "pointer"
messageElement.style.userSelect = "none"

// Desktop click handler - simplified and more reliable
messageElement.addEventListener("click", (e) => {
  // Don't trigger reply if clicking on voice controls
  if (e.target.closest(".voice-controls")) {
    return
  }

  e.preventDefault()
  e.stopPropagation()
  console.log("Message clicked for reply:", messageData)

  // Add visual feedback
  messageElement.style.transform = "scale(0.98)"
  messageElement.style.transition = "transform 0.1s ease"
  setTimeout(() => {
    messageElement.style.transform = "scale(1)"
    messageElement.classList.add("reply-selected")
    setTimeout(() => messageElement.classList.remove("reply-selected"), 500)
  }, 100)

  setReplyTo(messageData)
})

// Mobile touch handlers with improved detection
let touchStartTime = 0
let hasMoved = false

messageElement.addEventListener("touchstart",
  (e) => {
    // Don't trigger reply if touching voice controls
    if (e.target.closest(".voice-controls")) {
      return
    }

    touchStartX = e.touches[0].clientX
    touchStartY = e.touches[0].clientY
    touchStartTime = Date.now()
    touchTarget = messageElement
    isSwiping = false
    hasMoved = false
    console.log("Touch start on message")
  },
  { passive: true },
)

messageElement.addEventListener("touchmove",
  (e) => {
    if (!touchStartX || !touchStartY || touchTarget !== messageElement) return

    const touchX = e.touches[0].clientX
    const touchY = e.touches[0].clientY
    const diffX = touchStartX - touchX
    const diffY = touchStartY - touchY

    hasMoved = true

    // Check for horizontal swipe (left swipe to reply)
    if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
      isSwiping = true
      messageElement.style.transform = `translateX(${Math.min(0, -diffX * 0.3)}px)`
      messageElement.style.transition = "none"
      console.log("Swiping detected, diffX:", diffX)
      e.preventDefault()
    }
  },
  { passive: false },
)

messageElement.addEventListener("touchend",
  (e) => {
    const touchEndTime = Date.now()
    const touchDuration = touchEndTime - touchStartTime
    console.log("Touch end - isSwiping:", isSwiping, "hasMoved:", hasMoved, "duration:", touchDuration)

    // Reset transform
    messageElement.style.transform = ""
    messageElement.style.transition = "transform 0.3s ease"

    if (touchTarget === messageElement) {
      if (isSwiping) {
        // Swipe to reply
        console.log("Reply triggered by swipe")
        messageElement.classList.add("reply-selected")
        setTimeout(() => messageElement.classList.remove("reply-selected"), 500)
        setReplyTo(messageData)
      } else if (!hasMoved && touchDuration < 500) {
        // Quick tap to reply (fallback for devices where swipe doesn't work well)
        console.log("Reply triggered by tap")
        messageElement.classList.add("reply-selected")
        setTimeout(() => messageElement.classList.remove("reply-selected"), 500)
        setReplyTo(messageData)
      }
    }

    // Reset touch variables
    touchStartX = 0
    touchStartY = 0
    isSwiping = false
    touchTarget = null
    hasMoved = false
    touchStartTime = 0
  },
  { passive: true },
)

// Add visual reply indicator that's always visible on mobile
const replyIndicator = document.createElement("div")
replyIndicator.className = "reply-indicator"
replyIndicator.innerHTML = "↩️ Reply"

// Make indicator more visible on mobile
if (window.innerWidth <= 768) {
  replyIndicator.style.opacity = "0.7"
  replyIndicator.style.right = "-50px"
}

messageElement.appendChild(replyIndicator)

// Add hover effect for desktop
messageElement.addEventListener("mouseenter", () => {
  if (window.innerWidth > 768) {
    messageElement.style.transform = "translateY(-2px)"
    messageElement.style.boxShadow = "0 6px 20px rgba(102, 126, 234, 0.2)"
  }
})

messageElement.addEventListener("mouseleave", () => {
  if (window.innerWidth > 768) {
    messageElement.style.transform = ""
    messageElement.style.boxShadow = ""
  }
})
}

if (typeof io === "undefined") {
console.error("Socket.IO library failed to load!")
showMessage("Socket.IO Failed to Load", "error")
return
}

loadSoundPreference()

function initializeSocket() {
try {
 socket = io(window.location.origin, {
    transports: ["polling", "websocket"],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 2000,
    forceNew: true,
  })

  console.log("Socket.IO connection attempt started")

  socket.on("connect", () => {
    console.log("✅ Connected to server with ID:", socket.id)
    isConnected = true
    showConnectionStatus("Connected", "green")
  })

  socket.on("disconnect", (reason) => {
    console.log("❌ Disconnected from server. Reason:", reason)
    isConnected = false
    showConnectionStatus("Disconnected: " + reason, "red")
  })

  socket.on("connect_error", (error) => {
    console.error("❌ Connection error:", error)
    isConnected = false
    showConnectionStatus("Connection Error", "red")
  })

  socket.on("auth-response", (response) => {
    handleAuthResponse(response)
  })

  socket.on("update", (update) => {
    console.log("📢 Received update:", update)
    renderMessage("update", { text: update })
    if (update.includes("joined")) {
      playUserJoinSound()
    }
  })

  socket.on("chat", (message) => {
    console.log("💬 Received message:", message)
    renderMessage("other", message)
    playNotificationSound()
    showBrowserNotification(message)
  })

  socket.on("userCount", (count) => {
    console.log("👥 Total users online:", count)
    updateUserCount(count)
  })
} catch (error) {
  console.error("❌ Socket.IO initialization failed:", error)
  socket = null
  isConnected = false
  showConnectionStatus("Initialization Failed", "red")
}
}

function showBrowserNotification(message) {
if ("Notification" in window && Notification.permission === "granted") {
  const body = message.type === "voice" ? `🎤 Voice message (${message.duration}s)` : message.text

  const notification = new Notification(`New message from ${message.username}`, {
    body: body,
    icon: "/favicon.ico",
    tag: "chat-message",
  })

  setTimeout(() => notification.close(), 4000)
}
}

function requestNotificationPermission() {
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      showMessage("Browser notifications enabled!", "success")
    }
  })
}
}

initializeSocket()

function showScreen(screenName) {
document.querySelectorAll(".screen").forEach((screen) => {
  screen.classList.remove("active")
})
document.querySelector(`.${screenName}`).classList.add("active")

if (screenName === "chat-screen") {
  addSoundToggleButton()
  addVoiceButton()
  requestNotificationPermission()
}
}

function addSoundToggleButton() {
const userInfo = document.querySelector(".user-info")
if (userInfo && !document.querySelector("#sound-toggle")) {
  const soundBtn = document.createElement("button")
  soundBtn.id = "sound-toggle"
  soundBtn.textContent = soundEnabled ? "🔊" : "🔇"
  soundBtn.title = soundEnabled ? "Sound On - Click to mute" : "Sound Off - Click to enable"
  soundBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            padding: 6px 10px;
            border-radius: 12px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s ease;
            margin-right: 10px;
        `

  soundBtn.addEventListener("click", toggleSound)
  soundBtn.addEventListener("mouseenter", function () {
    this.style.background = "rgba(255, 255, 255, 0.3)"
  })
  soundBtn.addEventListener("mouseleave", function () {
    this.style.background = "rgba(255, 255, 255, 0.2)"
  })

  userInfo.insertBefore(soundBtn, userInfo.firstChild)
}
}

function addVoiceButton() {
const typebox = document.querySelector(".typebox")
if (typebox && !document.querySelector("#voice-btn")) {
  const voiceBtn = document.createElement("button")
  voiceBtn.id = "voice-btn"
  voiceBtn.innerHTML = "🎤"
  voiceBtn.title = "Record Voice Message"
  voiceBtn.style.cssText = `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s ease;
    margin-right: 8px;
    width: 45px;
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  voiceBtn.addEventListener("click", () => {
    if (isRecording) {
      stopVoiceRecording()
    } else {
      startVoiceRecording()
    }
  })

  voiceBtn.addEventListener("mouseenter", function () {
    if (!isRecording) {
      this.style.transform = "scale(1.1)"
    }
  })

  voiceBtn.addEventListener("mouseleave", function () {
    if (!isRecording) {
      this.style.transform = "scale(1)"
    }
  })

  // Insert voice button before send button
  const sendBtn = document.querySelector("#send-message")
  typebox.insertBefore(voiceBtn, sendBtn)
}
}

// Sign In functionality
app.querySelector("#signin-btn").addEventListener("click", () => {
const username = app.querySelector("#signin-username").value.trim()
const password = app.querySelector("#signin-password").value.trim()

if (!username || !password) {
  showMessage("Please enter both username and password", "error")
  return
}

if (socket && isConnected) {
  socket.emit("signin", { username, password })
} else {
  showMessage("Not connected to server", "error")
}
})

// Sign Up functionality
app.querySelector("#signup-btn").addEventListener("click", () => {
const username = app.querySelector("#signup-username").value.trim()
const password = app.querySelector("#signup-password").value.trim()
const confirmPassword = app.querySelector("#confirm-password").value.trim()

if (!username || !password || !confirmPassword) {
  showMessage("Please fill in all fields", "error")
  return
}

if (username.length < 3) {
  showMessage("Username must be at least 3 characters", "error")
  return
}

if (password !== confirmPassword) {
  showMessage("Passwords don't match", "error")
  return
}

if (password.length < 4) {
  showMessage("Password must be at least 4 characters", "error")
  return
}

if (socket && isConnected) {
  socket.emit("signup", { username, password })
} else {
  showMessage("Not connected to server", "error")
}
})

// Screen switching
app.querySelector("#go-to-signup").addEventListener("click", () => {
showScreen("signup-screen")
clearInputs()
})

app.querySelector("#go-to-signin").addEventListener("click", () => {
showScreen("signin-screen")
clearInputs()
})

// Handle authentication response
function handleAuthResponse(response) {
if (response.success) {
  currentUser = response.username
  app.querySelector("#current-user").textContent = `Welcome, ${currentUser}`
  showScreen("chat-screen")
  showMessage(response.message, "success")
  if (socket && isConnected) {
    socket.emit("newuser", currentUser)
  }
} else {
  showMessage(response.message, "error")
}
}

function clearInputs() {
app.querySelectorAll("input").forEach((input) => {
  input.value = ""
})
const existingMessages = document.querySelectorAll(".error-message, .success-message, .info-message")
existingMessages.forEach((msg) => msg.remove())
clearReply()
}

function showMessage(message, type) {
const existingMessages = document.querySelectorAll(".error-message, .success-message, .info-message")
existingMessages.forEach((msg) => msg.remove())

const messageEl = document.createElement("div")
messageEl.className = type === "error" ? "error-message" : type === "info" ? "info-message" : "success-message"
messageEl.textContent = message

const activeForm = document.querySelector(".screen.active .form")
if (activeForm) {
  activeForm.appendChild(messageEl)
  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.remove()
    }
  }, 4000)
}
}

app.querySelector("#exit-chat").addEventListener("click", () => {
// Stop any ongoing recording
if (isRecording) {
  stopVoiceRecording()
}

if (socket && isConnected && currentUser) {
  socket.emit("exituser", currentUser)
}

showScreen("signin-screen")
app.querySelector(".messages").innerHTML = ""
currentUser = ""
clearInputs()
})

app.querySelector("#send-message").addEventListener("click", () => {
sendMessage()
})

app.querySelector("#message-input").addEventListener("keypress", (e) => {
if (e.key === "Enter") {
  sendMessage()
}
})

app.querySelector("#signin-password").addEventListener("keypress", (e) => {
if (e.key === "Enter") {
  app.querySelector("#signin-btn").click()
}
})

app.querySelector("#confirm-password").addEventListener("keypress", (e) => {
if (e.key === "Enter") {
  app.querySelector("#signup-btn").click()
}
})

function sendMessage() {
const message = app.querySelector("#message-input").value.trim()
if (message.length === 0) {
  return
}

if (!currentUser) {
  showMessage("Please sign in first", "error")
  return
}

console.log("Sending message:", message)

const messageData = {
  username: currentUser,
  type: "text",
  text: message,
  replyTo: replyingTo
    ? {
        username: replyingTo.username,
        text: replyingTo.type === "voice" ? `🎤 Voice message (${replyingTo.duration}s)` : replyingTo.text,
        id: replyingTo.id,
      }
    : null,
  id: Date.now() + Math.random(),
}

renderMessage("my", messageData)
playMessageSentSound()

if (socket && isConnected) {
  socket.emit("chat", messageData)
} else {
  renderMessage("update", { text: "Message not sent - disconnected from server" })
}

app.querySelector("#message-input").value = ""
clearReply()
}

function renderMessage(type, message) {
const messageContainer = app.querySelector(".chat-screen .messages")
const el = document.createElement("div")

if (!message.id) {
  message.id = Date.now() + Math.random()
}

if (type === "my") {
  el.setAttribute("class", "message my-message" + (message.replyTo ? " has-reply" : ""))
  let messageContent = ""

  if (message.type === "voice") {
    const audioPlayer = createAudioPlayer(message.audioData, message.duration, message.id)
    messageContent = `
      <div>${message.replyTo
          ? `
          <div class="reply-context">
            <div class="reply-author">${message.replyTo.username}</div>
            <div class="reply-message">${message.replyTo.text}</div>
          </div>
        `
          : ""}
        <div class="name">Me</div>
        <div class="voice-message">${audioPlayer.outerHTML}
        </div>
      </div>
    `
  } else {
    messageContent = `
      <div>${message.replyTo
          ? `
          <div class="reply-context">
            <div class="reply-author">${message.replyTo.username}</div>
            <div class="reply-message">${message.replyTo.text}</div>
          </div>
        `
          : ""}
        <div class="name">Me</div>
        <div class="text">${message.text}</div>
      </div>
    `
  }

  el.innerHTML = messageContent

  // Re-attach event listeners for voice controls
  if (message.type === "voice") {
    const audioPlayer = createAudioPlayer(message.audioData, message.duration, message.id)
    const voiceContainer = el.querySelector(".voice-message")
    voiceContainer.innerHTML = ""
    voiceContainer.appendChild(audioPlayer)
  }
} else if (type === "other") {
  el.setAttribute("class", "message other-message" + (message.replyTo ? " has-reply" : ""))
  let messageContent = ""

  if (message.type === "voice") {
    const audioPlayer = createAudioPlayer(message.audioData, message.duration, message.id)
    messageContent = `
      <div>${message.replyTo
          ? `
          <div class="reply-context">
            <div class="reply-author">${message.replyTo.username}</div>
            <div class="reply-message">${message.replyTo.text}</div>
          </div>
        `
          : ""}
        <div class="name">${message.username}</div>
        <div class="voice-message">${audioPlayer.outerHTML}
        </div>
      </div>
    `
  } else {
    messageContent = `
      <div>${message.replyTo
          ? `
          <div class="reply-context">
            <div class="reply-author">${message.replyTo.username}</div>
            <div class="reply-message">${message.replyTo.text}</div>
          </div>
        `
          : ""}
        <div class="name">${message.username}</div>
        <div class="text">${message.text}</div>
      </div>
    `
  }

  el.innerHTML = messageContent

  // Re-attach event listeners for voice controls
  if (message.type === "voice") {
    const audioPlayer = createAudioPlayer(message.audioData, message.duration, message.id)
    const voiceContainer = el.querySelector(".voice-message")
    voiceContainer.innerHTML = ""
    voiceContainer.appendChild(audioPlayer)
  }

  // Add interactions to other users' messages only
  addMessageInteractions(el, message)
} else if (type === "update") {
  el.setAttribute("class", "update")
  el.innerText = message.text
}

messageContainer.appendChild(el)
messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight
}

function showConnectionStatus(status, color) {
const existingStatus = document.querySelector(".connection-status")
if (existingStatus) {
  existingStatus.remove()
}

const statusEl = document.createElement("div")
statusEl.className = "connection-status"
statusEl.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: ${color};
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        z-index: 1000;
    `
statusEl.textContent = status
document.body.appendChild(statusEl)

setTimeout(() => {
  if (statusEl.parentNode) {
    statusEl.remove()
  }
}, 3000)
}

function updateUserCount(count) {
const header = document.querySelector(".header .logo")
if (header) {
  const existingCount = header.querySelector(".user-count")
  if (existingCount) {
    existingCount.remove()
  }

  const countEl = document.createElement("span")
  countEl.className = "user-count"
  countEl.style.cssText = `
            background: rgba(255, 255, 255, 0.2);
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 11px;
            margin-left: 8px;
        `
  countEl.textContent = `${count} online`
  header.appendChild(countEl)
}
}

// Add CSS for voice message animations
const style = document.createElement("style")
style.textContent = `
@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
}

.voice-message-container {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 12px 16px;
  margin: 4px 0;
  min-width: 200px;
}

.voice-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.play-pause-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.play-pause-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.voice-progress {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.voice-progress-bar {
  height: 100%;
  background: rgba(255, 255, 255, 0.6);
  width: 0%;
  transition: width 0.1s ease;
}

.voice-duration {
  font-size: 12px;
  opacity: 0.8;
  min-width: 35px;
  text-align: right;
}

.other-message .voice-message-container {
  background: rgba(102, 126, 234, 0.1);
}

.other-message .play-pause-btn {
  background: rgba(102, 126, 234, 0.2);
  color: #667eea;
}

.other-message .play-pause-btn:hover {
  background: rgba(102, 126, 234, 0.3);
}

.other-message .voice-progress {
  background: rgba(102, 126, 234, 0.2);
}

.other-message .voice-progress-bar {
  background: #667eea;
}
`
document.head.appendChild(style)

})()