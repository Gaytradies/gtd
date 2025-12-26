/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { User, MessageCircle, MapPin, ShieldCheck, Star, CheckCircle, Briefcase, ArrowRight, X, DollarSign, Settings, LogOut, Send, Edit2, ClipboardList, AlertCircle, Camera, Image as ImageIcon, Navigation, Ban, Flag, Mail, Clock, Calendar, MoreHorizontal, Shield, Lock } from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, deleteField, serverTimestamp, query, orderBy, where, increment, Timestamp, limit, writeBatch } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

import { getAppId, auth, db, storage } from '../config/firebase';
import { BASE64_SIZE_RATIO, ADMIN_EMAIL } from '../constants';
import { getNextAvailableDateTime, isCurrentlyUnavailable, getCurrentUnavailabilityInfo, formatTimeSlot, getDefaultCoverPhoto } from '../utils';
import { Button, Input, Badge, Avatar } from '../components/ui';
import { logServiceIntent } from '../services/tradieServices';
import { detectWorkMessage, buildWorkWarning, sendModerationReport, updateDeliveryReceipts, updateReadReceipts, shouldBlockForWorkPolicy } from '../services/chatModeration';
import { soundService } from '../services/sound';

const processImageToWebP = (file, { maxSizeBytes = 600 * 1024, maxWidth = 1280, thumbWidth = 320 } = {}) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = async () => {
                try {
                    const scale = Math.min(1, maxWidth / img.width);
                    const targetW = Math.round(img.width * scale);
                    const targetH = Math.round(img.height * scale);
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, targetW, targetH);

                    let quality = 0.82;
                    let blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
                    while (blob && blob.size > maxSizeBytes && quality > 0.4) {
                        quality -= 0.08;
                        blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
                    }

                    const thumbScale = Math.min(1, thumbWidth / img.width);
                    const thumbW = Math.round(img.width * thumbScale);
                    const thumbH = Math.round(img.height * thumbScale);
                    const thumbCanvas = document.createElement('canvas');
                    thumbCanvas.width = thumbW;
                    thumbCanvas.height = thumbH;
                    const thumbCtx = thumbCanvas.getContext('2d');
                    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
                    const thumbBlob = await new Promise(res => thumbCanvas.toBlob(res, 'image/webp', 0.7));

                    resolve({ blob, thumbBlob });
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = reject;
            img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// --- Shop, Job Board, Chat, Profile (Mostly GT1 Structure) ---

const Shop = () => {
    const handleSubscribeElite = () => {
        window.location.href = "https://buy.stripe.com/14AbJ13P36bHbAzbND6c000";
    };

    // Features page - GayTradies Elite
    return (
        <div className="p-5 bg-slate-900 min-h-screen">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-extrabold flex items-center gap-3 text-slate-100 mb-2">
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-2 rounded-xl shadow-lg">
                            <Star className="text-white" size={28}/>
                        </div>
                        GayTradies Elite
                    </h2>
                    <p className="text-slate-400 text-sm">Unlock premium features and enhanced privacy</p>
                </div>

                {/* Elite Features Cards */}
                <div className="space-y-4">
                    {/* Premium Badge */}
                    <div className="bg-gradient-to-br from-orange-900/30 to-yellow-900/30 rounded-2xl p-6 border-2 border-orange-600 shadow-xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-orange-600 p-3 rounded-xl">
                                <Shield size={24} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Elite Membership</h3>
                            </div>
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed mb-4">
                            Get access to exclusive features designed for privacy, security, and a premium experience.
                        </p>
                        <div className="bg-slate-800/60 rounded-xl p-4 border border-orange-600/30">
                            <h4 className="font-bold text-white mb-3 text-sm">What's Included:</h4>
                            <ul className="space-y-2 text-sm text-slate-300">
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                    <span><strong>Incognito Mode:</strong> Browse anonymously without revealing your profile</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                    <span><strong>Advanced Privacy:</strong> Control who can see your profile and photos</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                    <span><strong>Photo Blur Control:</strong> Hide photos until you're ready to share</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                    <span><strong>Screenshot Detection:</strong> Get notified when someone screenshots your chat</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                                    <span><strong>Elite Badge:</strong> Stand out with a verified elite member badge</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Pricing Card */}
                    <div className="bg-slate-800 rounded-2xl p-6 border-2 border-slate-700 shadow-lg">
                        <div className="text-center mb-4">
                            <div className="text-4xl font-extrabold text-white mb-2">
                                £9.99<span className="text-lg text-slate-400">/month</span>
                            </div>
                            <p className="text-slate-400 text-sm">Cancel anytime, no commitments</p>
                        </div>
                        <button 
                            onClick={handleSubscribeElite}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                        >
                            Join GayTradies Elite
                        </button>
                        <p className="text-center text-xs text-slate-500 mt-3">
                            Includes 3-day free trial. You won't be charged until trial ends.
                        </p>
                    </div>

                    {/* Settings Link */}
                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 text-center">
                        <p className="text-sm text-slate-400">
                            Elite members can manage their subscription in Settings
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const isEmailVerifiedForProfile = (user, profile) => {
    return !!(
        user?.emailVerified ||
        profile?.emailVerified === true ||
        profile?.emailVerifiedOverride === true
    );
};

const JobRequestForm = ({ user, tradie, onCancel, onSuccess, userProfile }) => {
  const [jobData, setJobData] = useState({ title: '', description: '', estimatedHours: 2, urgency: 'standard' });
  const [budgetError, setBudgetError] = useState('');
  
  // Calculate budget based on tradie's hourly rate
  const tradieHourlyRate = parseFloat(tradie.rate) || 0;
  const calculatedBudget = (tradieHourlyRate * jobData.estimatedHours).toFixed(2);
  const minBudget = tradieHourlyRate > 0 ? tradieHourlyRate : 0;

  const submitJob = async () => {
    if(!jobData.title) return;
    
    // Validate estimated hours
    if (jobData.estimatedHours < 1) {
      setBudgetError('Please estimate at least 1 hour for the job');
      return;
    }
    
    // Check email verification - reload user first to get latest status
    if (user) {
      try {
        await user.reload();
        const updatedUser = auth.currentUser;
        
        const emailVerified = isEmailVerifiedForProfile(updatedUser, userProfile);

        if (!emailVerified) {
          alert('Please verify your email before requesting jobs. Check your inbox for the verification link.');
          return;
        }
      } catch (err) {
        console.error('Error checking verification:', err);
        // If reload fails, fall back to cached status
        if (!isEmailVerifiedForProfile(user, userProfile)) {
          alert('Please verify your email before requesting jobs. Check your inbox for the verification link.');
          return;
        }
      }
    }
    
    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'), {
       ...jobData,
       budget: `£${calculatedBudget}`,
       hourlyRate: tradieHourlyRate,
       clientUid: user.uid,
       tradieUid: tradie.uid,
       tradieName: tradie.name || tradie.username,
       clientName: user.displayName || 'Client', 
       status: 'Pending',
       createdAt: serverTimestamp()
    });
    onSuccess();
  };

  return (
    <div className="px-4 py-6 pb-24 bg-slate-900 text-slate-100 min-h-screen">
      <div className="max-w-lg mx-auto">
        {/* Header Card */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-3xl shadow-2xl p-6 mb-6 relative overflow-hidden border border-orange-500/40">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIxIDEuNzktNCA0LTRINDB2LTRoLTRjLTIuMjEgMC00IDEuNzktNCA0djRoNHYtNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-10"></div>
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="text-white" size={28} strokeWidth={2.5} />
                <h1 className="text-2xl font-black text-white">Request a Job</h1>
              </div>
              <p className="text-orange-100 text-sm font-medium">Hiring {tradie.name || tradie.username}</p>
            </div>
            <Button variant="ghost" onClick={onCancel} className="text-white hover:bg-slate-800/20 px-3 py-2 rounded-xl">
              <X size={20} strokeWidth={2.5} />
            </Button>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-slate-900 border-2 border-orange-500/40 rounded-2xl p-4 mb-6 flex gap-3 shadow-lg">
          <AlertCircle className="text-orange-300 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm">
            <p className="font-semibold text-orange-100 mb-1">Secure booking process</p>
            <p className="text-orange-200/80">Budget is calculated from the tradie's hourly rate. Full details and your address are shared only after you've agreed and paid securely through the platform.</p>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-slate-900 rounded-3xl shadow-xl border-2 border-slate-800 p-6 space-y-6">
          
          {/* Job Title */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="text-orange-300" size={20} />
              <label className="block text-sm font-bold text-slate-100">Job Title *</label>
            </div>
            <Input 
              placeholder="e.g. Fix leaky kitchen tap" 
              value={jobData.title} 
              onChange={e => setJobData({...jobData, title: e.target.value})}
              className="text-base bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-400 mt-1.5 ml-1">Be specific and clear about the work needed</p>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Edit2 className="text-orange-300" size={20} />
              <label className="block text-sm font-bold text-slate-100">Brief Description</label>
            </div>
            <Input 
              textarea 
              rows={3} 
              placeholder="e.g. Kitchen tap is dripping and needs fixing"
              value={jobData.description} 
              onChange={e => setJobData({...jobData, description: e.target.value})}
              className="text-base bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
              maxLength={200}
            />
            <div className="flex items-center justify-between mt-1.5 ml-1">
              <p className="text-xs text-slate-400">Keep it brief - full details will be discussed after booking</p>
              <p className="text-xs text-slate-400">{jobData.description.length}/200</p>
            </div>
          </div>

          {/* Estimated Hours & Budget */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="text-orange-300" size={20} />
              <label className="block text-sm font-bold text-slate-100">Estimated Job Duration</label>
            </div>
            
            {tradieHourlyRate > 0 ? (
              <>
                <div className="mb-3">
                  <input 
                    type="range" 
                    min="1" 
                    max="8" 
                    step="0.5"
                    value={jobData.estimatedHours} 
                    onChange={e => { 
                      setJobData({...jobData, estimatedHours: parseFloat(e.target.value)});
                      setBudgetError('');
                    }}
                    className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-400">1 hour</span>
                    <span className="text-xs font-bold text-orange-300">{jobData.estimatedHours} hour{jobData.estimatedHours !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-slate-400">8 hours</span>
                  </div>
                </div>
                
                {/* Budget Display */}
                <div className="bg-slate-900 border-2 border-green-500/40 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs text-green-200 font-medium mb-1">Estimated Budget</p>
                      <p className="text-2xl font-black text-green-100">£{calculatedBudget}</p>
                    </div>
                    <DollarSign className="text-green-300" size={32} strokeWidth={2.5} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-green-200">
                    <div className="flex-1 bg-slate-800 rounded-lg px-2 py-1.5 text-green-100 border border-green-500/30">
                      <span className="font-semibold">Rate:</span> £{tradieHourlyRate}/hr
                    </div>
                    <X size={12} className="text-green-300" />
                    <div className="flex-1 bg-slate-800 rounded-lg px-2 py-1.5 text-green-100 border border-green-500/30 text-right">
                      <span className="font-semibold">{jobData.estimatedHours}hrs</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-900 border-2 border-blue-500/40 rounded-xl p-4 text-center">
                <AlertCircle className="text-blue-300 mx-auto mb-2" size={24} />
                <p className="text-sm text-blue-100 font-semibold">Price will be confirmed by the tradie</p>
                <p className="text-xs text-blue-300 mt-1">This tradie hasn't set an hourly rate yet</p>
              </div>
            )}
            {budgetError && <p className="text-xs text-red-400 mt-2 ml-1">{budgetError}</p>}
          </div>

          {/* Urgency */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="text-orange-300" size={20} />
              <label className="block text-sm font-bold text-slate-100">When do you need this done?</label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'urgent', label: 'Urgent', icon: AlertCircle, desc: 'ASAP' },
                { value: 'standard', label: 'Standard', icon: Calendar, desc: '1-2 weeks' },
                { value: 'flexible', label: 'Flexible', icon: Clock, desc: 'No rush' }
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setJobData({...jobData, urgency: option.value})}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    jobData.urgency === option.value 
                      ? 'border-orange-500 bg-orange-900/30 text-orange-200 shadow' 
                      : 'border-slate-800 bg-slate-900 text-slate-200 hover:border-orange-500/40'
                  }`}
                >
                  <option.icon 
                    size={20} 
                    className={`mx-auto mb-1 ${jobData.urgency === option.value ? 'text-orange-300' : 'text-slate-400'}`}
                  />
                  <p className={`text-xs font-semibold ${jobData.urgency === option.value ? 'text-orange-900' : 'text-slate-300'}`}>
                    {option.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{option.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tips Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-700/50 rounded-2xl p-4">
            <div className="flex items-start gap-2 mb-2">
              <ShieldCheck className="text-blue-400 flex-shrink-0 mt-0.5" size={18} />
              <p className="text-sm font-semibold text-blue-100">What happens next?</p>
            </div>
            <ul className="text-xs text-blue-200 space-y-1.5 ml-6">
              <li className="list-disc">The tradie will review your request within 24-48 hours</li>
              <li className="list-disc">You'll chat to finalize details and schedule</li>
              <li className="list-disc">Pay securely once you've agreed on the work</li>
              <li className="list-disc">Your address will only be shared after payment</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button 
              variant="ghost" 
              className="flex-1 py-3 text-base font-semibold border-2 border-slate-700 hover:border-slate-600 rounded-xl" 
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button 
              onClick={submitJob} 
              variant="secondary" 
              className="flex-1 py-3 text-base font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg hover:shadow-xl rounded-xl transition-all"
              disabled={!jobData.title.trim()}
            >
              <Send size={18} className="mr-2" />
              Send Request
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const JobManager = ({ user, userProfile, onPendingCountChange, showToast = () => {} }) => {
    const [viewMode, setViewMode] = useState('active'); 
    const [jobs, setJobs] = useState([]); 
    const [adverts, setAdverts] = useState([]);
    const [hiddenJobs, setHiddenJobs] = useState([]);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [cancelTargetJob, setCancelTargetJob] = useState(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [jobToReview, setJobToReview] = useState(null);
    const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
    const [showInfoRequestModal, setShowInfoRequestModal] = useState(false);
    const [jobForInfoRequest, setJobForInfoRequest] = useState(null);
    const [infoPhotos, setInfoPhotos] = useState([]);
    const [infoDescription, setInfoDescription] = useState('');
    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [jobForQuote, setJobForQuote] = useState(null);
    const [quoteData, setQuoteData] = useState({ hourlyRate: '', estimatedHours: '', notes: '' });
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [jobToDecline, setJobToDecline] = useState(null);
    const [declineReason, setDeclineReason] = useState('');
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [jobForBooking, setJobForBooking] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
    const [serviceAddress, setServiceAddress] = useState('');
    const [servicePhone, setServicePhone] = useState('');
    const [serviceEmail, setServiceEmail] = useState('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [jobForPayment, setJobForPayment] = useState(null);
    const [processingPayment, setProcessingPayment] = useState(false);
    const [showPhotoGallery, setShowPhotoGallery] = useState(false);
    const [galleryPhotos, setGalleryPhotos] = useState([]);
    useEffect(() => {
        if(!user || !db) return;
        const q = collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs');
        const unsub = onSnapshot(q, (snapshot) => {
            const myJobs = snapshot.docs.map(d => ({id: d.id, ...d.data()}))
                .filter(job => job.clientUid === user.uid || job.tradieUid === user.uid)
                .sort((a, b) => {
                    // Sort by creation date, newest first
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return bTime - aTime;
                });
            setJobs(myJobs);
            
        });
        return () => unsub();
    }, [user]);

    useEffect(() => {
        if (viewMode === 'board' && userProfile?.role === 'tradie' && userProfile?.verified && db && user) {
             // Load job adverts
             const advertsQuery = collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_adverts');
             const advertsUnsub = onSnapshot(advertsQuery, (snapshot) => {
                 const ads = snapshot.docs.map(d => ({id: d.id, ...d.data()}))
                     .filter(ad => ad.tradeCategory === userProfile.trade);
                 setAdverts(ads);
             });
             
             // Load hidden jobs for this tradie
             const hiddenQuery = collection(db, 'artifacts', getAppId(), 'public', 'data', 'hidden_jobs');
             const hiddenUnsub = onSnapshot(hiddenQuery, (snapshot) => {
                 const hidden = snapshot.docs
                     .filter(d => d.data().tradieUid === user.uid)
                     .map(d => d.data().advertId);
                 setHiddenJobs(hidden);
             });
             
             return () => {
                 advertsUnsub();
                 hiddenUnsub();
             };
        }
    }, [viewMode, userProfile, user]);

    // Calculate pending actions count for badges/notifications
    const getPendingActionsCount = React.useCallback((currentJobs = jobs, currentUserProfile = userProfile) => {
        const isTradie = currentUserProfile?.role === 'tradie';
        return currentJobs.filter(job => {
            if (isTradie) {
                // Tradie pending actions
                if (job.tradieUid === user.uid) {
                    if (job.status === 'Pending') return true;
                    if (job.status === 'InfoProvided') return true;
                    if (job.status === 'BookingRequested') return true;
                    if (job.status === 'Completed' && job.awaitingReview && !job.tradieReviewed) return true;
                }
            } else {
                // Client pending actions
                if (job.clientUid === user.uid) {
                    if (job.status === 'InfoRequested') return true;
                    if (job.status === 'QuoteProvided') return true;
                    if (job.status === 'BookingConfirmed') return true;
                    if (job.status === 'Completed' && job.awaitingReview && !job.clientReviewed) return true;
                }
            }
            return false;
        }).length;
    }, [jobs, user, userProfile]);

    // Update pending jobs count whenever jobs change
    useEffect(() => {
        if (onPendingCountChange && user) {
            const count = getPendingActionsCount();
            onPendingCountChange(count);
        }
    }, [jobs, user, getPendingActionsCount, onPendingCountChange]);

    const handleCancelOrDispute = async () => {
        if (!cancelTargetJob || !cancelReason.trim()) return;
        const isDispute = ['PaymentComplete', 'InProgress', 'Completed'].includes(cancelTargetJob.status);
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', cancelTargetJob.id), {
                status: isDispute ? 'Dispute' : 'Cancelled',
                cancelReason,
                cancelledBy: user.uid,
                cancelledAt: serverTimestamp()
            });
            showToast(isDispute ? 'Dispute opened' : 'Job cancelled', 'success');
        } catch (error) {
            console.error("Error cancelling/disputing job:", error);
            showToast("Failed to update job", "error");
        } finally {
            setShowCancelModal(false);
            setCancelReason('');
            setCancelTargetJob(null);
        }
    };

    const handleStatusUpdate = async (jobId, newStatus) => {
        try {
            const batch = writeBatch(db);
            const jobRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId);
            const updateData = { status: newStatus };
            
            // If moving to Completed, set awaitingReview flags and delete ALL private information for privacy
            if (newStatus === 'Completed') {
                updateData.awaitingReview = true;
                updateData.completedAt = serverTimestamp();
                updateData.jobPhotos = []; // Delete photos for privacy
                updateData.infoPhotos = deleteField();
                updateData.infoDescription = deleteField();
                // Delete ALL private contact information
                updateData['serviceLocation.address'] = '';
                updateData['serviceLocation.phone'] = '';
                updateData['serviceLocation.email'] = '';
                
                // Move payment from "On Hold" to "Available" for tradie
                const jobDoc = await getDoc(jobRef);
                if (jobDoc.exists()) {
                    const jobData = jobDoc.data();
                    if (jobData.tradieUid && jobData.tradieAmount) {
                        const tradieAmount = jobData.tradieAmount;
                        
                        // Update tradie's balance
                        const profileRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', jobData.tradieUid);
                        batch.update(profileRef, {
                            'finances.onHoldBalance': increment(-tradieAmount),
                            'finances.availableBalance': increment(tradieAmount)
                        });
                        
                        // Update transaction status
                        const q = query(
                            collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'),
                            where('jobId', '==', jobId),
                            where('type', '==', 'payment')
                        );
                        const txSnapshot = await getDocs(q);
                        txSnapshot.docs.forEach(txDoc => {
                            batch.update(txDoc.ref, { status: 'completed' });
                        });
                    }
                }
            }
            
            batch.update(jobRef, updateData);
            await batch.commit();
            
            // Immediately show review modal for the user who just completed the job
            if (newStatus === 'Completed') {
                const jobDoc = await getDoc(jobRef);
                if (jobDoc.exists()) {
                    setJobToReview({ id: jobId, ...jobDoc.data() });
                    setShowReviewModal(true);
                }
            }
        } catch (error) {
            console.error("Error updating job status:", error);
        }
    };

    const handleSubmitReview = async () => {
        if (!jobToReview || !reviewData.rating) return;
        
        try {
            const job = jobToReview;
            const isTradie = job.tradieUid === user.uid;
            const reviewedUid = isTradie ? job.clientUid : job.tradieUid;
            const reviewedName = isTradie ? job.clientName : job.tradieName;
            const reviewerRole = isTradie ? 'tradie' : 'client';
            
            // Add review to collection
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_reviews'), {
                jobId: job.id,
                reviewedUid,
                reviewedName,
                reviewerUid: user.uid,
                reviewerName: userProfile?.name || user.displayName || 'User',
                reviewerRole,
                rating: reviewData.rating,
                comment: reviewData.comment.trim(),
                createdAt: serverTimestamp()
            });
            
            // Update job to mark this user's review as complete
            const reviewField = isTradie ? 'tradieReviewed' : 'clientReviewed';
            const updateData = { [reviewField]: true };
            
            // Check if both have now reviewed - if so, archive the job (keep minimal record)
            const otherReviewField = isTradie ? 'clientReviewed' : 'tradieReviewed';
            const bothReviewed = job[otherReviewField]; // Other party already reviewed
            
            if (bothReviewed) {
                // Both parties have now reviewed - Archive job (keep minimal record for legal/dispute purposes)
                updateData.archived = true;
                updateData.awaitingReview = false;
                // Generate invoice ID if not exists
                if (!job.invoiceId) {
                    updateData.invoiceId = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                }
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', job.id), updateData);
            } else {
                // Only this user has reviewed so far, update the job
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', job.id), updateData);
            }
            
            // Update tradie's average rating if reviewing a tradie
            if (reviewerRole === 'client') {
                await updateTradieRating(reviewedUid);
            }
            
            setShowReviewModal(false);
            setJobToReview(null);
            setReviewData({ rating: 5, comment: '' });
        } catch (error) {
            console.error("Error submitting review:", error);
        }
    };
    
    const updateTradieRating = async (tradieUid) => {
        try {
            // Get all reviews for this tradie
            const reviewsRef = collection(db, 'artifacts', getAppId(), 'public', 'data', 'job_reviews');
            const q = query(reviewsRef, where('reviewedUid', '==', tradieUid), where('reviewerRole', '==', 'client'));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) return;
            
            const reviews = snapshot.docs.map(doc => doc.data());
            const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            const reviewCount = reviews.length;
            
            // Update tradie profile
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', tradieUid), {
                rating: avgRating,
                reviews: reviewCount
            });
        } catch (error) {
            console.error("Error updating tradie rating:", error);
        }
    };

    // Enhanced workflow handlers
    const handleRequestInfo = async (jobId) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'InfoRequested',
                infoRequestedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error requesting info:", error);
        }
    };

    const handleSubmitInfo = async () => {
        if (!jobForInfoRequest || (infoPhotos.length === 0 && !infoDescription.trim())) {
            showToast?.("Add a note or photo before submitting", "error");
            return;
        }
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForInfoRequest.id), {
                status: 'InfoProvided',
                infoPhotos: infoPhotos.length ? infoPhotos : deleteField(),
                infoDescription: infoDescription.trim() ? infoDescription.trim() : deleteField(),
                infoProvidedAt: serverTimestamp()
            });
            setShowInfoRequestModal(false);
            setInfoPhotos([]);
            setInfoDescription('');
            setJobForInfoRequest(null);
        } catch (error) {
            console.error("Error submitting info:", error);
        }
    };

    const handleSubmitQuote = async () => {
        if (!jobForQuote || !quoteData.hourlyRate || !quoteData.estimatedHours) return;
        try {
            const total = parseFloat(quoteData.hourlyRate) * parseFloat(quoteData.estimatedHours);
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForQuote.id), {
                status: 'QuoteProvided',
                quote: {
                    hourlyRate: parseFloat(quoteData.hourlyRate),
                    estimatedHours: parseFloat(quoteData.estimatedHours),
                    total: total,
                    notes: quoteData.notes
                },
                quotedAt: serverTimestamp()
            });
            setShowQuoteModal(false);
            setQuoteData({ hourlyRate: '', estimatedHours: '', notes: '' });
            setJobForQuote(null);
        } catch (error) {
            console.error("Error submitting quote:", error);
        }
    };

    const handleDeclineJob = async () => {
        if (!jobToDecline || !declineReason.trim()) return;
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobToDecline.id), {
                status: 'Declined',
                declineReason: declineReason,
                declinedAt: serverTimestamp()
            });
            setShowDeclineModal(false);
            setDeclineReason('');
            setJobToDecline(null);
        } catch (error) {
            console.error("Error declining job:", error);
        }
    };

    const handleAcceptQuote = async (jobId) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'QuoteAccepted',
                quoteAcceptedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error accepting quote:", error);
        }
    };

    const handleDeclineQuote = async (jobId) => {
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'QuoteDeclined',
                quoteDeclinedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error declining quote:", error);
        }
    };

    const handleSubmitBooking = async () => {
        if (!jobForBooking || !selectedDate || !selectedTimeSlot || !serviceAddress.trim() || !servicePhone.trim()) {
            alert('Please fill in all required fields (address, phone, date, and time)');
            return;
        }
        try {
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForBooking.id), {
                status: 'BookingRequested',
                booking: {
                    date: selectedDate,
                    timeSlot: selectedTimeSlot
                },
                serviceLocation: {
                    address: serviceAddress,
                    phone: servicePhone,
                    email: serviceEmail || user?.email || ''
                },
                bookingRequestedAt: serverTimestamp()
            });
            setShowBookingModal(false);
            setSelectedDate(null);
            setSelectedTimeSlot('');
            setServiceAddress('');
            setServicePhone('');
            setServiceEmail('');
            setJobForBooking(null);
        } catch (error) {
            console.error("Error submitting booking:", error);
        }
    };

    const handleConfirmBooking = async (jobId) => {
        try {
            const job = jobs.find(j => j.id === jobId);
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobId), {
                status: 'BookingConfirmed',
                bookingConfirmedAt: serverTimestamp()
            });
            
            // Update tradie's work calendar to mark the booked time as unavailable
            if (job?.tradieUid && job?.booking?.date && job?.booking?.timeSlot) {
                const tradieRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', job.tradieUid);
                const tradieDoc = await getDoc(tradieRef);
                const tradieData = tradieDoc.data();
                const workCalendar = tradieData?.workCalendar || {};
                
                // Support both old format (array) and new format (object)
                const dateSlots = workCalendar[job.booking.date];
                let updatedDateSlots;
                
                if (Array.isArray(dateSlots)) {
                    // Old format - convert to new format
                    updatedDateSlots = {};
                    dateSlots.forEach(slot => {
                        updatedDateSlots[slot] = { reason: 'manual' };
                    });
                } else {
                    updatedDateSlots = dateSlots || {};
                }
                
                // Add the booked time slot
                updatedDateSlots[job.booking.timeSlot] = { 
                    reason: 'job', 
                    jobId: jobId 
                };
                
                await updateDoc(tradieRef, {
                    [`workCalendar.${job.booking.date}`]: updatedDateSlots
                });
            }
        } catch (error) {
            console.error("Error confirming booking:", error);
        }
    };

    const handleProcessPayment = async () => {
        if (!jobForPayment) return;
        setProcessingPayment(true);
        
        // Simulate payment processing
        setTimeout(async () => {
            try {
                const paymentAmount = jobForPayment.quote?.total || 0;
                const commission = paymentAmount * 0.15; // 15% commission
                const tradieAmount = paymentAmount - commission;
                
                // Update job status
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', jobForPayment.id), {
                    status: 'PaymentComplete',
                    paymentCompletedAt: serverTimestamp(),
                    paymentAmount: paymentAmount,
                    commission: commission,
                    tradieAmount: tradieAmount
                });
                
                // Add payment to tradie's "On Hold" balance
                if (jobForPayment.tradieUid) {
                    await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', jobForPayment.tradieUid), {
                        'finances.onHoldBalance': increment(tradieAmount),
                        'finances.totalEarnings': increment(tradieAmount),
                        'finances.totalCommissionPaid': increment(commission)
                    });
                    
                    // Create transaction record
                    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'transactions'), {
                        tradieUid: jobForPayment.tradieUid,
                        jobId: jobForPayment.id,
                        jobTitle: jobForPayment.title || 'Job',
                        type: 'payment',
                        amount: tradieAmount,
                        commission: commission,
                        status: 'onHold',
                        createdAt: serverTimestamp()
                    });
                }
                
                setProcessingPayment(false);
                setShowPaymentModal(false);
                
                // Store jobId before clearing state
                const completedJobId = jobForPayment.id;
                setJobForPayment(null);
                
                // Automatically move to InProgress after payment
                setTimeout(async () => {
                    try {
                        await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'jobs', completedJobId), {
                            status: 'InProgress',
                            startedAt: serverTimestamp()
                        });
                    } catch (error) {
                        console.error("Error moving job to InProgress:", error);
                    }
                }, 1000);
            } catch (error) {
                console.error("Error processing payment:", error);
                setProcessingPayment(false);
            }
        }, 2000);
    };

    const handleAcceptJobFromBoard = async (advert) => {
        try {
            // Create a new job from the advert
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'jobs'), {
                title: advert.title,
                description: advert.description,
                budget: advert.budget,
                clientUid: advert.clientUid,
                clientName: advert.clientName,
                tradieUid: user.uid,
                tradieName: userProfile?.name || user.displayName || 'Tradie',
                tradieTrade: userProfile?.trade || 'Tradie',
                status: 'TradieAccepted', // Awaiting client approval
                source: 'job_board',
                createdAt: serverTimestamp(),
                acceptedAt: serverTimestamp()
            });
            
            // Delete the advert from job_adverts
            await deleteDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'job_adverts', advert.id));
            
            showToast('Job accepted! Awaiting client approval.');
        } catch (error) {
            console.error("Error accepting job from board:", error);
            showToast('Error accepting job');
        }
    };

    const handleHideJobFromBoard = async (advertId) => {
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'hidden_jobs'), {
                tradieUid: user.uid,
                advertId: advertId,
                hiddenAt: serverTimestamp()
            });
            showToast('Job hidden from your view');
        } catch (error) {
            console.error("Error hiding job:", error);
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length + infoPhotos.length > 5) {
            alert('Maximum 5 photos allowed');
            return;
        }

        const readers = files.map(file => {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
        });

        const results = await Promise.all(readers);
        setInfoPhotos([...infoPhotos, ...results]);
    };

    const getStatusColor = (status) => {
        switch(status) {
            case 'Pending': return 'bg-slate-800 text-yellow-200 border border-yellow-500/40';
            case 'TradieAccepted': return 'bg-slate-800 text-cyan-200 border border-cyan-500/40';
            case 'InfoRequested': return 'bg-slate-800 text-blue-200 border border-blue-500/40';
            case 'InfoProvided': return 'bg-slate-800 text-cyan-200 border border-cyan-500/40';
            case 'QuoteProvided': return 'bg-slate-800 text-indigo-200 border border-indigo-500/40';
            case 'QuoteAccepted': return 'bg-slate-800 text-purple-200 border border-purple-500/40';
            case 'BookingRequested': return 'bg-slate-800 text-violet-200 border border-violet-500/40';
            case 'BookingConfirmed': return 'bg-slate-800 text-fuchsia-200 border border-fuchsia-500/40';
            case 'PaymentComplete': return 'bg-slate-800 text-green-200 border border-green-500/40';
            case 'Accepted': return 'bg-slate-800 text-blue-200 border border-blue-500/40';
            case 'InProgress': return 'bg-slate-800 text-purple-200 border border-purple-500/40';
            case 'Completed': return 'bg-slate-800 text-green-200 border border-green-500/40';
            case 'Declined': return 'bg-slate-800 text-red-200 border border-red-500/40';
            case 'QuoteDeclined': return 'bg-slate-800 text-red-200 border border-red-500/40';
            default: return 'bg-slate-800 text-slate-200 border border-slate-600';
        }
    };

    // Get contextual status message for job
const getJobStatusMessage = (job, isTradie) => {
        const tradeName = job.tradeName || job.tradieTrade || 'Tradie';
        const clientName = job.clientName || 'Client';
        const quoteAmount = job.quote?.total?.toFixed(2) || '0';
        const paymentAmount = job.paymentAmount?.toFixed(2) || quoteAmount;
        const bookingDate = job.booking?.date || '';
        const bookingTime = job.booking?.timeSlot || '';
        
        if (job.status === 'Declined') {
            return { text: `This job was declined. ${job.declineReason ? `Reason: ${job.declineReason}` : ''}`, color: 'bg-slate-800 border-red-500/40 text-red-100' };
        }
        if (job.status === 'QuoteDeclined') {
            return isTradie 
                ? { text: `${clientName} declined your quote.`, color: 'bg-slate-800 border-red-500/40 text-red-100' }
                : { text: `You declined the quote from ${tradeName}.`, color: 'bg-slate-800 border-slate-600 text-slate-200' };
        }
        
        switch(job.status) {
            case 'TradieAccepted':
                return isTradie
                    ? { text: `You accepted this job from the Job Board. Awaiting ${clientName}'s approval.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' }
                    : { text: `${tradeName} has accepted your job posting. Review and approve to continue.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' };
            
            case 'Pending':
                return isTradie 
                    ? { text: `New job request from ${clientName}. Review and respond.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' }
                    : { text: `Your request is being reviewed by the ${tradeName}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' };
            
            case 'Accepted':
                return isTradie
                    ? { text: `Job accepted. Request more info or provide a quote to ${clientName}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' }
                    : { text: `The ${tradeName} has accepted your job request.`, color: 'bg-slate-800 border-green-500/40 text-green-100' };
            
            case 'InfoRequested':
                return isTradie
                    ? { text: `Awaiting additional information from ${clientName}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' }
                    : { text: `The ${tradeName} has accepted your job and requested more information from you.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' };
            
            case 'InfoProvided':
                return isTradie
                    ? { text: `${clientName} has provided the requested information. Review to provide a quote.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' }
                    : { text: `Information submitted. Awaiting quote from the ${tradeName}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' };
            
            case 'QuoteProvided':
                return isTradie
                    ? { text: `${clientName} is reviewing your quote of £${quoteAmount}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' }
                    : { text: `The ${tradeName} has provided a quote of £${quoteAmount}. Review and accept to continue.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' };
            
            case 'QuoteAccepted':
                return isTradie
                    ? { text: `${clientName} has accepted your quote of £${quoteAmount}. Awaiting booking selection.`, color: 'bg-slate-800 border-green-500/40 text-green-100' }
                    : { text: `You've accepted the quote of £${quoteAmount}. Select a booking time to proceed.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' };
            
            case 'BookingRequested':
                return isTradie
                    ? { text: `New booking request for ${bookingDate} at ${bookingTime}. Confirm to proceed.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' }
                    : { text: `Booking request sent for ${bookingDate} at ${bookingTime}. Awaiting confirmation from the ${tradeName}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' };
            
            case 'BookingConfirmed':
                return isTradie
                    ? { text: `Booking confirmed for ${bookingDate} at ${bookingTime}. Awaiting payment from ${clientName}.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' }
                    : { text: `The ${tradeName} has confirmed your booking. Complete payment to begin work.`, color: 'bg-slate-800 border-orange-500/40 text-orange-100' };
            
            case 'PaymentComplete':
                return { text: `Payment of £${paymentAmount} received. Work is now in progress.`, color: 'bg-slate-800 border-green-500/40 text-green-100' };
            
            case 'InProgress':
                return isTradie
                    ? { text: `Payment of £${paymentAmount} received. You can begin work.`, color: 'bg-slate-800 border-green-500/40 text-green-100' }
                    : { text: `Payment of £${paymentAmount} received. Work is now in progress.`, color: 'bg-slate-800 border-blue-500/40 text-blue-100' };
            
            case 'Completed':
                if (job.awaitingReview) {
                    const hasReviewed = isTradie ? job.tradieReviewed : job.clientReviewed;
                    if (hasReviewed) {
                        return { text: 'Job completed. Review submitted.', color: 'bg-slate-800 border-green-500/40 text-green-100' };
                    }
                    return { text: 'Job completed! Leave a review to help others.', color: 'bg-slate-800 border-orange-500/40 text-orange-100' };
                }
                return { text: 'Job completed successfully.', color: 'bg-slate-800 border-green-500/40 text-green-100' };
            
            default:
                return { text: '', color: '' };
        }
    };

    // Get progress steps for job
    const getJobProgress = (job) => {
        const steps = [
            { label: 'Request Made', key: 'request' },
            { label: 'Request Accepted', key: 'accepted' },
            { label: 'More Information', key: 'info' },
            { label: 'Quote Provided', key: 'quote' },
            { label: 'Quote Accepted', key: 'quoteAccepted' },
            { label: 'Booking Confirmed', key: 'booking' },
            { label: 'Payment Received', key: 'payment' },
            { label: 'Work Complete', key: 'complete' }
        ];

        const status = job.status;
        const infoSkipped = status !== 'Declined' && status !== 'Pending' && 
                          status !== 'Accepted' && status !== 'InfoRequested' && 
                          status !== 'InfoProvided' && job.status !== 'QuoteDeclined';

        return steps.map(step => {
            switch(step.key) {
                case 'request':
                    return { ...step, status: 'complete' };
                case 'accepted':
                    return { ...step, status: ['Pending', 'Declined'].includes(status) ? 'pending' : 'complete' };
                case 'info':
                    if (status === 'InfoRequested' || status === 'InfoProvided') return { ...step, status: 'complete' };
                    if (infoSkipped) return { ...step, status: 'skipped' };
                    return { ...step, status: 'pending' };
                case 'quote':
                    return { ...step, status: ['QuoteProvided', 'QuoteAccepted', 'BookingRequested', 'BookingConfirmed', 'PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : 'pending' };
                case 'quoteAccepted':
                    return { ...step, status: ['QuoteAccepted', 'BookingRequested', 'BookingConfirmed', 'PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : status === 'QuoteDeclined' ? 'skipped' : 'pending' };
                case 'booking':
                    return { ...step, status: ['BookingConfirmed', 'PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : 'pending' };
                case 'payment':
                    return { ...step, status: ['PaymentComplete', 'InProgress', 'Completed'].includes(status) ? 'complete' : 'pending' };
                case 'complete':
                    return { ...step, status: status === 'Completed' ? 'complete' : 'pending' };
                default:
                    return { ...step, status: 'pending' };
            }
        });
    };


    return (
        <div className="p-4">
            {userProfile?.role === 'tradie' ? (
                <div className="flex bg-gradient-to-r bg-slate-900 p-1.5 rounded-2xl mb-6 shadow-lg border-2 border-slate-700">
                    <button onClick={() => setViewMode('active')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${viewMode === 'active' ? 'bg-orange-900/20 shadow-md text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}>
                        📋 My Active Jobs
                    </button>
                    <button onClick={() => setViewMode('board')} className={`flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${viewMode === 'board' ? 'bg-orange-900/20 shadow-md text-white' : 'text-slate-500 hover:bg-slate-800 hover:text-slate-200'}`}>
                        ✨ Job Board (New Leads)
                    </button>
                </div>
            ) : (
                <h2 className="text-xl font-bold mb-4 text-slate-100">📋 My Requests & Adverts</h2>
            )}

            {viewMode === 'board' && userProfile?.role === 'tradie' && (
                <div>
                     {!userProfile.verified ? (
                         <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl text-center">
                             <ShieldCheck className="mx-auto text-slate-400 mb-2" size={32} />
                             <h3 className="font-bold text-slate-200">Verification Required</h3>
                             <p className="text-sm text-slate-500 mb-4">To see the Job Board, you must verify your trade ID.</p>
                             <div className="inline-flex items-center gap-1 bg-slate-900 px-3 py-1 rounded border border-slate-700 text-xs font-mono text-slate-500"><Badge type="locked" text="Locked" /></div>
                         </div>
                     ) : (
                         <div className="space-y-3">
                             {adverts.length === 0 ? (
                                 <div className="text-center py-8 text-slate-400"><ClipboardList className="mx-auto mb-2 opacity-50" size={32}/><p>No open adverts for {userProfile.trade}s right now.</p></div>
                             ) : (
                                 adverts
                                     .filter(ad => !hiddenJobs.includes(ad.id)) // Filter out hidden jobs
                                     .map(ad => (
                                     <div key={ad.id} className="bg-gradient-to-br from-white to-orange-50/30 p-4 rounded-2xl border-2 border-orange-700/50 shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden">
                                         <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-[10px] px-3 py-1.5 rounded-bl-xl font-bold shadow-md flex items-center gap-1">
                                             <span className="animate-pulse">✨</span> New Lead
                                         </div>
                                         <h4 className="font-bold text-slate-100 text-base pr-20">{ad.title}</h4>
                                         <div className="flex items-center gap-2 text-xs text-slate-300 mb-2 mt-1">
                                             <span className="flex items-center gap-1 bg-slate-900/60 px-2 py-1 rounded-lg shadow-sm">
                                                 <MapPin size={12} className="text-orange-500" /> {ad.location}
                                             </span>
                                             <span className="font-bold bg-gradient-to-r from-green-500 to-green-600 text-white px-2 py-1 rounded-lg shadow-sm">
                                                 💰 {ad.budget}
                                             </span>
                                         </div>
                                         <p className="text-sm text-slate-300 mb-3 bg-white/40 p-2 rounded-lg">{ad.description}</p>
                                         <div className="flex gap-2">
                                             <Button variant="primary" className="flex-1 py-2 text-xs" onClick={() => handleAcceptJobFromBoard(ad)}>
                                                 ✓ Accept Job
                                             </Button>
                                             <Button variant="ghost" className="flex-1 py-2 text-xs border-slate-700" onClick={() => handleHideJobFromBoard(ad.id)}>
                                                 Hide
                                             </Button>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>
                     )}
                </div>
            )}

            {viewMode === 'active' && (
                <div className="space-y-3">
                    {jobs.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 bg-slate-900 rounded-xl border border-slate-100"><Briefcase size={40} className="mx-auto mb-2 opacity-50"/><p>No active jobs.</p></div>
                    ) : (
                        jobs.map(job => {
                            const isTradie = job.tradieUid === user.uid;
                            const isClient = job.clientUid === user.uid;
                            const hasReviewed = isTradie ? job.tradieReviewed : job.clientReviewed;
                            const needsReview = job.status === 'Completed' && job.awaitingReview && !hasReviewed;
                            const statusMessage = getJobStatusMessage(job, isTradie);
                            const progressSteps = getJobProgress(job);
                            
                            // Archived job - minimal display with invoice and report option
                            if (job.archived) {
                                return (
                                    <div key={job.id} className="bg-slate-900 p-4 rounded-xl border border-slate-700">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-300">{job.title}</h4>
                                                <p className="text-xs text-slate-400 mt-1">Invoice: {job.invoiceId}</p>
                                            </div>
                                            <span className="text-xs font-medium px-2 py-1 rounded bg-green-900/30 text-green-200">
                                                ✓ Reviewed
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 mb-3">
                                            {isTradie ? `Client: ${job.clientName}` : `Tradie: ${job.tradieName}`}
                                        </p>
                                        <button
                                            onClick={() => {
                                                // TODO: Implement report/dispute modal
                                                alert('Report/dispute functionality coming soon. Invoice: ' + job.invoiceId);
                                            }}
                                            className="text-xs text-orange-300 hover:text-orange-300 font-medium flex items-center gap-1"
                                        >
                                            <Flag size={12} />
                                            Report something
                                        </button>
                                    </div>
                                );
                            }
                            
                            return (
                                <div key={job.id} className="bg-slate-900 p-4 rounded-2xl border-2 border-slate-800 shadow-lg hover:shadow-2xl transition-all duration-300 text-slate-100">
                                    {/* Status Message Banner */}
                                    {statusMessage.text && (
                                        <div className={`mb-3 p-3 rounded-xl border-2 text-xs font-bold shadow-md backdrop-blur-sm ${statusMessage.color} flex items-start gap-2`}>
                                            <span className="text-base flex-shrink-0">
                                                {statusMessage.color.includes('orange') && '⚠️'}
                                                {statusMessage.color.includes('blue') && 'ℹ️'}
                                                {statusMessage.color.includes('green') && '✓'}
                                                {statusMessage.color.includes('red') && '✗'}
                                            </span>
                                            <span className="flex-1">{statusMessage.text}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-3">
                                        {/* Main Job Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-100 flex-1 text-base">{job.title}</h4>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full capitalize shadow-md border-2 ${getStatusColor(job.status)}`}>
                                                        {job.status}
                                                    </span>
                                                    <button
                                                        onClick={() => { setCancelTargetJob(job); setCancelReason(''); setShowCancelModal(true); }}
                                                        className="p-1 text-orange-200 hover:bg-slate-800 rounded text-xs font-bold"
                                                    >
                                                        {['PaymentComplete','InProgress','Completed'].includes(job.status) ? 'Dispute' : 'Cancel'}
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-300 mb-2">
                                                {isTradie ? `Client: ${job.clientName}` : `Tradie: ${job.tradieName}`}
                                            </p>
                                            <p className="text-sm text-slate-100 bg-slate-800 p-2 rounded mb-2">{job.description}</p>
                                            {job.budget && <p className="text-xs text-slate-300 mb-2">Budget: {job.budget}</p>}
                                    
                                    {/* Show photos if available */}
                                    {job.infoPhotos && job.infoPhotos.length > 0 && (
                                        <div className="mb-2">
                                            <p className="text-xs font-bold text-slate-300 mb-1">Photos:</p>
                                            <div className="flex gap-1 flex-wrap">
                                                {job.infoPhotos.slice(0, 3).map((photo, idx) => (
                                                    <img key={idx} src={photo} className="w-16 h-16 object-cover rounded border cursor-pointer" 
                                                        onClick={() => { setGalleryPhotos(job.infoPhotos); setShowPhotoGallery(true); }} />
                                                ))}
                                                {job.infoPhotos.length > 3 && (
                                                    <div className="w-16 h-16 bg-slate-800 rounded border flex items-center justify-center text-xs font-bold text-slate-500 cursor-pointer"
                                                        onClick={() => { setGalleryPhotos(job.infoPhotos); setShowPhotoGallery(true); }}>
                                                        +{job.infoPhotos.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Show quote if available */}
                                    {job.quote && (
                                        <div className="mb-2 p-3 bg-slate-800 border-2 border-indigo-500/40 rounded-xl shadow-md">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-base bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500">💰</span>
                                                <p className="text-xs font-bold text-indigo-100">Quote Details</p>
                                            </div>
                                            <div className="bg-slate-900/60 backdrop-blur-sm rounded-lg p-2 mb-1">
                                                <p className="text-sm text-indigo-100 font-bold">£{job.quote.hourlyRate}/hr × {job.quote.estimatedHours}hrs = £{job.quote.total.toFixed(2)}</p>
                                            </div>
                                            {job.quote.notes && <p className="text-xs text-indigo-200 mt-2 italic">{job.quote.notes}</p>}
                                        </div>
                                    )}
                                    
                                    {/* Show booking if available */}
                                    {job.booking && (
                                        <div className="mb-2 p-3 bg-slate-800 border-2 border-purple-500/40 rounded-xl shadow-md">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500">📅</span>
                                                <p className="text-xs font-bold text-purple-100">Booking: {job.booking.date} - {job.booking.timeSlot}</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Show service location (address) to tradie after booking confirmed */}
                                    {isTradie && job.serviceLocation && ['InProgress', 'Completed'].includes(job.status) && (
                                        <div className="mb-2 p-3 bg-slate-800 border-2 border-blue-500/40 rounded-xl shadow-md">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-base bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500">📍</span>
                                                <p className="text-xs font-bold text-blue-100">Service Location</p>
                                            </div>
                                            <div className="bg-slate-900/60 backdrop-blur-sm rounded-lg p-2 space-y-1">
                                                <p className="text-xs text-blue-100 font-medium">{job.serviceLocation.address}</p>
                                                <p className="text-xs text-blue-200 flex items-center gap-1">
                                                    <span>📞</span> {job.serviceLocation.phone}
                                                </p>
                                                {job.serviceLocation.email && (
                                                    <p className="text-xs text-blue-200 flex items-center gap-1">
                                                        <span>✉️</span> {job.serviceLocation.email}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                    
                                    {/* Progress Tracker Sidebar */}
                                    <div className="w-32 flex-shrink-0 bg-slate-900 p-3 rounded-xl border-2 border-slate-800 shadow-md text-slate-100">
                                        <p className="text-xs font-bold text-slate-100 mb-3 flex items-center gap-1">
                                            <span className="w-2 h-2 bg-orange-900/20 rounded-full animate-pulse"></span>
                                            Progress
                                        </p>
                                        <div className="space-y-2 relative">
                                            {/* Vertical connecting line */}
                                            <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-orange-400 to-slate-700"></div>
                                            
                                            {progressSteps.map((step, idx) => (
                                                <div key={idx} className="flex items-start gap-2 text-xs relative z-10">
                                                    <span className="mt-0.5 flex-shrink-0">
                                                        {step.status === 'complete' && (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-[10px] shadow-md border-2 border-white">✓</span>
                                                        )}
                                                        {step.status === 'skipped' && (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 text-white font-bold text-[10px] shadow-md border-2 border-white">✗</span>
                                                        )}
                                                        {step.status === 'pending' && (
                                                            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-900 border-2 border-slate-600 shadow-sm"></span>
                                                        )}
                                                    </span>
                                                    <span className={`leading-tight transition-all ${
                                                        step.status === 'complete' 
                                                            ? 'text-slate-200 font-bold' 
                                                            : step.status === 'skipped'
                                                            ? 'text-slate-400 line-through'
                                                            : 'text-slate-500'
                                                    }`}>
                                                        {step.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Action Buttons Section - Full Width Below */}
                                <div className="mt-3">
                                    {/* ENHANCED WORKFLOW ACTIONS */}
                                    
                                    {/* Client: Approve or decline tradie who accepted from Job Board */}
                                    {isClient && job.status === 'TradieAccepted' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobToDecline(job); setShowDeclineModal(true); }}>
                                                Decline Offer
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleStatusUpdate(job.id, 'Pending')}>
                                                Accept Offer
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Tradie: Initial response to Pending */}
                                    {isTradie && job.status === 'Pending' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobToDecline(job); setShowDeclineModal(true); }}>
                                                Decline
                                            </Button>
                                            <Button variant="ghost" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => {
                                                    setUserToBlock({
                                                        uid: job.clientUid,
                                                        name: job.clientName
                                                    });
                                                    setShowBlockConfirm(true);
                                                }}>
                                                Block
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleStatusUpdate(job.id, 'Accepted')}>
                                                Accept
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Tradie: After accepting - can request info or quote */}
                                    {isTradie && job.status === 'Accepted' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="secondary" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleRequestInfo(job.id)}>
                                                Request Info/Photos
                                            </Button>
                                            <Button variant="primary" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobForQuote(job); setShowQuoteModal(true); }}>
                                                Quote Price
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Client: Provide info when requested */}
                                    {isClient && job.status === 'InfoRequested' && (
                                        <Button variant="primary" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => { setJobForInfoRequest(job); setShowInfoRequestModal(true); }}>
                                            Upload Photos & Info
                                        </Button>
                                    )}
                                    
                                    {/* Tradie: Review info and quote or decline */}
                                    {isTradie && job.status === 'InfoProvided' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobToDecline(job); setShowDeclineModal(true); }}>
                                                Decline Job
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => { setJobForQuote(job); setShowQuoteModal(true); }}>
                                                Quote Price
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Client: Accept or decline quote */}
                                    {isClient && job.status === 'QuoteProvided' && (
                                        <div className="flex gap-2 mt-2">
                                            <Button variant="danger" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleDeclineQuote(job.id)}>
                                                Decline Quote
                                            </Button>
                                            <Button variant="success" className="py-1 px-3 text-xs flex-1" 
                                                onClick={() => handleAcceptQuote(job.id)}>
                                                Accept Quote
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Client: Select booking time */}
                                    {isClient && job.status === 'QuoteAccepted' && (
                                        <Button variant="primary" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => { setJobForBooking(job); setShowBookingModal(true); }}>
                                            Select Date & Time
                                        </Button>
                                    )}
                                    
                                    {/* Tradie: Confirm booking */}
                                    {isTradie && job.status === 'BookingRequested' && (
                                        <Button variant="success" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => handleConfirmBooking(job.id)}>
                                            Confirm Booking
                                        </Button>
                                    )}
                                    
                                    {/* Client: Make payment */}
                                    {isClient && job.status === 'BookingConfirmed' && (
                                        <Button variant="primary" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => { setJobForPayment(job); setShowPaymentModal(true); }}>
                                            Pay Now - £{job.quote?.total.toFixed(2)}
                                        </Button>
                                    )}
                                    
                                    {/* Show payment complete status */}
                                    {job.status === 'PaymentComplete' && (
                                        <div className="mt-3 p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-center">
                                            <CheckCircle className="inline-block text-green-400 mb-1" size={16} />
                                            <p className="text-xs text-green-200 font-medium">Payment Complete - £{job.paymentAmount?.toFixed(2)}</p>
                                        </div>
                                    )}
                                    
                                    {/* Only client can mark Completed when InProgress */}
                                    {job.status === 'InProgress' && isClient && (
                                        <Button variant="success" className="w-full py-1 text-xs mt-2" 
                                            onClick={() => handleStatusUpdate(job.id, 'Completed')}>
                                            Mark as Completed
                                        </Button>
                                    )}
                                    
                                    {/* Show review prompt when completed and awaiting review */}
                                    {needsReview && (
                                        <div className="mt-3 p-3 bg-orange-900/20 border border-orange-700/50 rounded-lg">
                                            <p className="text-sm font-bold text-orange-900 mb-2">How was your experience?</p>
                                            <Button variant="secondary" className="w-full py-2 text-xs"
                                                onClick={() => {
                                                    setJobToReview(job);
                                                    setShowReviewModal(true);
                                                }}>
                                                Leave a Review
                                            </Button>
                                        </div>
                                    )}
                                    
                                    {/* Show review submitted confirmation */}
                                    {job.status === 'Completed' && hasReviewed && (
                                        <div className="mt-3 space-y-2">
                                            <div className="p-3 bg-green-900/20 border-green-700/50 rounded-lg text-center">
                                                <CheckCircle className="inline-block text-green-400 mb-1" size={16} />
                                                <p className="text-xs text-green-200 font-medium">Review submitted</p>
                                            </div>
                                            
                                            {/* NEW FEATURE: Smart Dispute / Escrow */}
                                            <Button 
                                                variant="ghost" 
                                                className="w-full py-2 text-xs border border-red-500/30 text-red-300 hover:bg-red-900/20 flex items-center justify-center gap-2"
                                                onClick={() => {
                                                    setCancelTargetJob(job);
                                                    setCancelReason('');
                                                    setShowCancelModal(true);
                                                }}
                                            >
                                                <AlertCircle size={14} />
                                                Raise Dispute (Escrow Protection)
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Cancel/Dispute Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full space-y-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle size={20} className="text-orange-500" />
                            <h3 className="text-lg font-bold text-slate-100 mb-1">
                                {['PaymentComplete','InProgress','Completed'].includes(cancelTargetJob?.status || '') ? 'Open Dispute' : 'Cancel Job'}
                            </h3>
                        </div>
                        <p className="text-sm text-slate-300">Please provide a brief reason.</p>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="w-full border border-slate-700 rounded-xl p-2 text-sm focus:ring-2 focus:ring-orange-500"
                            rows="3"
                            placeholder="Reason..."
                        />
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowCancelModal(false); setCancelReason(''); setCancelTargetJob(null); }}>
                                Close
                            </Button>
                            <Button variant="secondary" className="flex-1" onClick={handleCancelOrDispute} disabled={!cancelReason.trim()}>
                                {['PaymentComplete','InProgress','Completed'].includes(cancelTargetJob?.status || '') ? 'Submit Dispute' : 'Confirm Cancel'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal - Cannot be dismissed, review is mandatory */}
            {showReviewModal && jobToReview && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 animate-in fade-in zoom-in">
                        <div className="mb-4">
                            <h3 className="text-xl font-black text-slate-100">Leave a Review</h3>
                            <p className="text-xs text-slate-400 mt-1">Review required to complete this job</p>
                        </div>
                        
                        <div className="mb-6">
                            <p className="text-sm text-slate-300 mb-1">
                                How was your experience with <span className="font-bold">
                                    {jobToReview.tradieUid === user.uid ? jobToReview.clientName : jobToReview.tradieName}
                                </span>?
                            </p>
                            <p className="text-xs text-slate-400">{jobToReview.title}</p>
                        </div>

                        {/* Star Rating */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-300 mb-3">Rating</label>
                            <div className="flex gap-2 justify-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setReviewData({ ...reviewData, rating: star })}
                                        className="transition-transform hover:scale-110"
                                    >
                                        <Star
                                            size={40}
                                            className={star <= reviewData.rating 
                                                ? 'fill-orange-500 text-orange-500' 
                                                : 'text-slate-300'
                                            }
                                        />
                                    </button>
                                ))}
                            </div>
                            <p className="text-center text-sm text-slate-300 mt-2 font-medium">
                                {reviewData.rating === 5 ? 'Excellent!' : 
                                 reviewData.rating === 4 ? 'Good' : 
                                 reviewData.rating === 3 ? 'Okay' : 
                                 reviewData.rating === 2 ? 'Poor' : 'Very Poor'}
                            </p>
                        </div>

                        {/* Comment */}
                        <div className="mb-6">
                            <label className="block text-sm font-bold text-slate-300 mb-2">
                                Comment (Optional)
                            </label>
                            <textarea
                                value={reviewData.comment}
                                onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                                placeholder="Share details about your experience..."
                                rows={4}
                                className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm"
                                maxLength={500}
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">
                                {reviewData.comment.length}/500
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => {
                                setShowReviewModal(false);
                                setJobToReview(null);
                                setReviewData({ rating: 5, comment: '' });
                            }}>
                                Skip
                            </Button>
                            <Button variant="secondary" className="flex-1" onClick={handleSubmitReview}>
                                Submit Review
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Info Request Modal (Client uploads photos/info) */}
            {showInfoRequestModal && jobForInfoRequest && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-100">Upload Photos & Info</h3>
                            <button onClick={() => { setShowInfoRequestModal(false); setInfoPhotos([]); setInfoDescription(''); }}>
                                <X className="text-slate-400 hover:text-slate-300" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-4">Upload photos and additional details about the job.</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Photos (up to 5)</label>
                            <input type="file" accept="image/*" multiple onChange={handleImageUpload} 
                                className="w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-900/20 file:text-orange-300 hover:file:bg-orange-900/30" />
                            {infoPhotos.length > 0 && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                    {infoPhotos.map((photo, idx) => (
                                        <div key={idx} className="relative">
                                            <img src={photo} className="w-16 h-16 object-cover rounded border" />
                                            <button onClick={() => setInfoPhotos(infoPhotos.filter((_, i) => i !== idx))}
                                                className="absolute -top-1 -right-1 bg-red-900/20 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Additional Info</label>
                            <textarea value={infoDescription} onChange={(e) => setInfoDescription(e.target.value)}
                                placeholder="Describe the location, access, specific requirements..."
                                rows={4} className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowInfoRequestModal(false); setInfoPhotos([]); setInfoDescription(''); }}>
                                Cancel
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={handleSubmitInfo} disabled={infoPhotos.length === 0 && !infoDescription.trim()}>
                                Commit
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Quote Modal (Tradie submits quote) */}
            {showQuoteModal && jobForQuote && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-100">Submit Quote</h3>
                            <button onClick={() => { setShowQuoteModal(false); setQuoteData({ hourlyRate: '', estimatedHours: '', notes: '' }); }}>
                                <X className="text-slate-400 hover:text-slate-300" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-4">Provide pricing for: <span className="font-bold">{jobForQuote.title}</span></p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Hourly Rate (£)</label>
                            <input type="number" value={quoteData.hourlyRate} onChange={(e) => setQuoteData({ ...quoteData, hourlyRate: e.target.value })}
                                placeholder="e.g. 50" className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Estimated Hours</label>
                            <input type="number" value={quoteData.estimatedHours} onChange={(e) => setQuoteData({ ...quoteData, estimatedHours: e.target.value })}
                                placeholder="e.g. 4" className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        {quoteData.hourlyRate && quoteData.estimatedHours && (
                            <div className="mb-4 p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
                                <p className="text-sm font-bold text-green-100">Total: £{(parseFloat(quoteData.hourlyRate) * parseFloat(quoteData.estimatedHours)).toFixed(2)}</p>
                            </div>
                        )}
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Notes (Optional)</label>
                            <textarea value={quoteData.notes} onChange={(e) => setQuoteData({ ...quoteData, notes: e.target.value })}
                                placeholder="Include materials, special considerations..."
                                rows={3} className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowQuoteModal(false); setQuoteData({ hourlyRate: '', estimatedHours: '', notes: '' }); }}>
                                Cancel
                            </Button>
                            <Button variant="success" className="flex-1" onClick={handleSubmitQuote} 
                                disabled={!quoteData.hourlyRate || !quoteData.estimatedHours}>
                                Submit Quote
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Decline Modal (Tradie provides reason) */}
            {showDeclineModal && jobToDecline && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-100">Decline Job</h3>
                            <button onClick={() => { setShowDeclineModal(false); setDeclineReason(''); }}>
                                <X className="text-slate-400 hover:text-slate-300" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-4">Please provide a reason for declining this job.</p>
                        
                        <div className="mb-4">
                            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                                placeholder="e.g. Outside my service area, job too small, already booked..."
                                rows={4} className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                                required />
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { setShowDeclineModal(false); setDeclineReason(''); }}>
                                Cancel
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={handleDeclineJob} disabled={!declineReason.trim()}>
                                Decline Job
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Booking Modal (Client selects date/time and provides service location) */}
            {showBookingModal && jobForBooking && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6 max-h-[75vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-100">Booking Details</h3>
                            <button onClick={() => { 
                                setShowBookingModal(false); 
                                setSelectedDate(null); 
                                setSelectedTimeSlot(''); 
                                setServiceAddress('');
                                setServicePhone('');
                                setServiceEmail('');
                            }}>
                                <X className="text-slate-400 hover:text-slate-300" />
                            </button>
                        </div>
                        
                        <p className="text-sm text-slate-300 mb-4">Provide service location and select date & time.</p>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Service Address <span className="text-red-500">*</span></label>
                            <textarea 
                                value={serviceAddress} 
                                onChange={(e) => setServiceAddress(e.target.value)}
                                placeholder="Enter the full address where work will be done"
                                rows={3}
                                className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Phone Number <span className="text-red-500">*</span></label>
                            <input 
                                type="tel" 
                                value={servicePhone} 
                                onChange={(e) => setServicePhone(e.target.value)}
                                placeholder="e.g., 07123 456789"
                                className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Email (Optional)</label>
                            <input 
                                type="email" 
                                value={serviceEmail} 
                                onChange={(e) => setServiceEmail(e.target.value)}
                                placeholder={user?.email || "your@email.com"}
                                className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" 
                            />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Date <span className="text-red-500">*</span></label>
                            <input type="date" value={selectedDate || ''} onChange={(e) => setSelectedDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                        </div>
                        
                        <div className="mb-4">
                            <label className="block text-sm font-bold text-slate-300 mb-2">Time Slot <span className="text-red-500">*</span></label>
                            <select value={selectedTimeSlot} onChange={(e) => setSelectedTimeSlot(e.target.value)}
                                className="w-full p-3 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                                <option value="">Select a time slot</option>
                                <option value="Morning (8AM-12PM)">Morning (8AM-12PM)</option>
                                <option value="Afternoon (12PM-8PM)">Afternoon (12PM-8PM)</option>
                                <option value="Evening (8PM-11PM)">Evening (8PM-11PM)</option>
                            </select>
                        </div>
                        
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => { 
                                setShowBookingModal(false); 
                                setSelectedDate(null); 
                                setSelectedTimeSlot(''); 
                                setServiceAddress('');
                                setServicePhone('');
                                setServiceEmail('');
                            }}>
                                Cancel
                            </Button>
                            <Button variant="primary" className="flex-1" onClick={handleSubmitBooking} 
                                disabled={!selectedDate || !selectedTimeSlot || !serviceAddress.trim() || !servicePhone.trim()}>
                                Request Booking
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Payment Modal (Client pays) */}
            {showPaymentModal && jobForPayment && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-black text-slate-100">Complete Payment</h3>
                            {!processingPayment && (
                                <button onClick={() => setShowPaymentModal(false)}>
                                    <X className="text-slate-400 hover:text-slate-300" />
                                </button>
                            )}
                        </div>
                        
                        <div className="mb-6 p-4 bg-slate-900 border border-slate-700 rounded-lg">
                            <p className="text-sm text-slate-300 mb-2">Job: <span className="font-bold">{jobForPayment.title}</span></p>
                            <p className="text-sm text-slate-300 mb-2">Tradie: <span className="font-bold">{jobForPayment.tradieName}</span></p>
                            <p className="text-2xl font-black text-slate-100 mt-4">£{jobForPayment.quote?.total.toFixed(2)}</p>
                            <p className="text-xs text-slate-400">£{jobForPayment.quote?.hourlyRate}/hr × {jobForPayment.quote?.estimatedHours}hrs</p>
                        </div>
                        
                        <p className="text-xs text-slate-400 mb-4 text-center">
                            💳 Payment will be processed via Stripe<br />
                            (Simulated for demo - no actual charge)
                        </p>
                        
                        <Button variant="success" className="w-full" onClick={handleProcessPayment} disabled={processingPayment}>
                            {processingPayment ? (
                                <><Clock className="animate-spin" size={16} /> Processing Payment...</>
                            ) : (
                                <>Pay £{jobForPayment.quote?.total.toFixed(2)}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
            
            {/* Photo Gallery Modal */}
            {showPhotoGallery && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4">
                    <div className="relative w-full max-w-2xl">
                        <button onClick={() => setShowPhotoGallery(false)} 
                            className="absolute -top-10 right-0 text-white hover:text-gray-300">
                            <X size={32} />
                        </button>
                        <div className="bg-slate-900 rounded-2xl p-4">
                            <div className="grid grid-cols-2 gap-4">
                                {galleryPhotos.map((photo, idx) => (
                                    <img key={idx} src={photo} className="w-full h-auto rounded border" />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// MessagesModal - Wrapper for ChatList and Winks with tabs
const MessagesModal = ({ user, onSelectProfile, onSelectChat, onClose }) => {
    const [activeTab, setActiveTab] = useState('messages');
    
    return (
        <div 
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-fade-in p-4"
            onClick={(e) => {
                // Close if clicking the backdrop
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-slate-900 w-full max-w-sm h-[60vh] rounded-2xl overflow-hidden shadow-2xl relative flex flex-col animate-scale-in">
                {/* Tab Headers */}
                <div className="flex border-b border-slate-700 bg-gradient-to-r from-slate-900 to-white">
                    <button 
                        onClick={() => setActiveTab('messages')}
                        className={`flex-1 py-4 px-6 font-bold text-sm transition-all duration-300 ${
                            activeTab === 'messages' 
                                ? 'text-orange-300 border-b-2 border-orange-600 bg-orange-900/20 scale-105' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        Messages
                    </button>
                    <button 
                        onClick={() => setActiveTab('winks')}
                        className={`flex-1 py-4 px-6 font-bold text-sm transition-all duration-300 ${
                            activeTab === 'winks' 
                                ? 'text-orange-300 border-b-2 border-orange-600 bg-orange-900/20 scale-105' 
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                        }`}
                    >
                        Winks 😉
                    </button>
                </div>
                
                {/* Tab Content */}
                {activeTab === 'messages' ? (
                    <ChatList user={user} onSelectProfile={onSelectProfile} onSelectChat={onSelectChat} onClose={onClose} />
                ) : (
                    <WinksList user={user} onSelectProfile={onSelectProfile} onClose={onClose} />
                )}
            </div>
        </div>
    );
};

// WinksList - Shows winks received by user
const WinksList = ({ user, onSelectProfile, onClose }) => {
    const [winks, setWinks] = useState([]);
    const [senderProfiles, setSenderProfiles] = useState({});
    const [sendingWink, setSendingWink] = useState(null);
    const [profilePictureRequests, setProfilePictureRequests] = useState([]);

    useEffect(() => {
        if (!db || !user) return;
        
        // Listen to winks where user is the recipient
        const winksQuery = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'),
            where('type', '==', 'wink'),
            where('recipientId', '==', user.uid),
            orderBy('timestamp', 'desc')
        );
        
        const unsub = onSnapshot(winksQuery, (snap) => {
            const winksList = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setWinks(winksList);
            
            // Fetch sender profiles
            winksList.forEach(async (wink) => {
                if (wink.senderId && !senderProfiles[wink.senderId]) {
                    const profileDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', wink.senderId));
                    if (profileDoc.exists()) {
                        setSenderProfiles(prev => ({
                            ...prev, 
                            [wink.senderId]: {...profileDoc.data(), uid: wink.senderId}
                        }));
                    }
                }
            });
        });
        
        return () => unsub();
    }, [user, senderProfiles]);
    
    // Listen to profile picture verification requests for blur detection
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'artifacts', getAppId(), 'private', 'data', 'profilePictureVerification'));
        const unsub = onSnapshot(q, (snap) => {
            const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProfilePictureRequests(requests);
        });
        return () => unsub();
    }, []);
    
    const handleSendWinkBack = async (recipientId) => {
        if (!user || !recipientId || sendingWink === recipientId) return;
        
        setSendingWink(recipientId);
        try {
            const currentUserData = senderProfiles[recipientId] ? 
                (await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid))).data() : 
                {};
            
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                type: 'wink',
                userId: recipientId,
                senderId: user.uid,
                from: user.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                senderName: currentUserData?.name || currentUserData?.username || 'Someone',
                senderPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                recipientId: recipientId,
                message: `${currentUserData?.name || currentUserData?.username || 'Someone'} winked back at you! 😉`,
                createdAt: serverTimestamp(),
                timestamp: serverTimestamp(),
                read: false
            });
            
            showToast(`Wink sent back! 😉`);
        } catch (error) {
            console.error('Error sending wink:', error);
            showToast('Failed to send wink');
        } finally {
            setSendingWink(null);
        }
    };
    
    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return date.toLocaleDateString();
    };
    
    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-white">
            <div className="p-6 border-b border-slate-700 bg-slate-900 flex items-center gap-4">
                <button 
                    onClick={onClose} 
                    className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                    title="Close"
                >
                    <X size={24} className="text-slate-300" />
                </button>
                <div className="flex-1">
                    <h2 className="font-bold text-2xl text-slate-100">Winks 😉</h2>
                    <p className="text-sm text-slate-500 mt-1">{winks.length} wink{winks.length !== 1 ? 's' : ''} received</p>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
                {winks.length === 0 ? (
                    <div className="text-center text-slate-400 mt-20 px-6">
                        <div className="text-7xl mb-4">😉</div>
                        <h3 className="font-bold text-lg text-slate-300 mb-2">No winks yet</h3>
                        <p className="text-sm text-slate-500">When someone winks at you, they'll appear here</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {winks.map(wink => {
                            const sender = senderProfiles[wink.senderId] || {};
                            
                            // Calculate blur status for sender
                            const isPending = profilePictureRequests.some(req => req.userId === wink.senderId && req.status === 'pending');
                            const shouldBlurSender = sender?.blurPhotos || isPending;
                            
                            return (
                                <div 
                                    key={wink.id} 
                                    className="p-4 flex items-center gap-4 hover:bg-slate-900 transition-colors"
                                >
                                    {/* Profile Picture - Click to open profile */}
                                    <div 
                                        className="relative flex-shrink-0 cursor-pointer"
                                        onClick={() => {
                                            if (sender.uid) {
                                                onSelectProfile(sender, 0);
                                            }
                                        }}
                                    >
                                        {sender.primaryPhoto || sender.photo ? (
                                            <div className="relative">
                                                <img 
                                                    src={sender.primaryPhoto || sender.photo} 
                                                    alt={sender.name || 'User'} 
                                                    className={`w-14 h-14 rounded-full object-cover border-2 shadow-md hover:border-orange-500 transition-all ${shouldBlurSender ? 'border-orange-500 blur-md scale-105' : 'border-white'}`}
                                                />
                                                {shouldBlurSender && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-14 h-14 rounded-full border-2 border-orange-500 bg-orange-900/20/20 backdrop-blur-sm flex items-center justify-center">
                                                            <Shield size={20} className="text-orange-300" strokeWidth={2.5} />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md hover:border-orange-500 transition-all">
                                                <User size={28} className="text-white"/>
                                            </div>
                                        )}
                                        {/* Wink emoji badge */}
                                        <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                                            <span className="text-sm">😉</span>
                                        </div>
                                    </div>
                                    
                                    {/* Wink Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className="font-bold truncate text-slate-100">
                                                {sender.name || sender.username || 'User'}
                                            </h4>
                                            <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                                {formatTime(wink.timestamp)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-500 truncate">
                                            Sent you a wink 😉
                                        </p>
                                    </div>
                                    
                                    {/* Wink Back Button */}
                                    <button
                                        onClick={() => handleSendWinkBack(wink.senderId)}
                                        disabled={sendingWink === wink.senderId}
                                        className={`flex-shrink-0 px-4 py-2 rounded-full font-bold text-sm transition-all ${
                                            sendingWink === wink.senderId
                                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
                                        }`}
                                    >
                                        {sendingWink === wink.senderId ? '...' : '😉 Wink Back'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChatList = ({ user, onSelectProfile, onSelectChat, onClose }) => {
  const [conversations, setConversations] = useState([]);
  const [partnerProfiles, setPartnerProfiles] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [profilePictureRequests, setProfilePictureRequests] = useState([]);

  useEffect(() => {
      if (!db) return;
      // Listen to conversations
      const unsub = onSnapshot(collection(db, 'artifacts', getAppId(), 'public', 'data', 'conversations'), (snap) => {
          const myConvos = snap.docs
              .map(d => ({id: d.id, ...d.data()}))
              .filter(c => c.participants && c.participants.includes(user.uid))
              .sort((a, b) => {
                  const timeA = a.lastMessageAt?.toMillis?.() || 0;
                  const timeB = b.lastMessageAt?.toMillis?.() || 0;
                  return timeB - timeA; // Most recent first
              });
          setConversations(myConvos);

          // Fetch partner profiles
          myConvos.forEach(async (conv) => {
              const partnerId = conv.participants.find(p => p !== user.uid);
              if (partnerId && !partnerProfiles[partnerId]) {
                  const profileDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', partnerId));
                  if (profileDoc.exists()) {
                      setPartnerProfiles(prev => ({...prev, [partnerId]: {...profileDoc.data(), uid: partnerId}}));
                  }
              }
          });
      });

      // Listen to unread messages
      const unreadQuery = query(
          collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
          where('recipientId', '==', user.uid),
          where('read', '==', false)
      );
      const unsubUnread = onSnapshot(unreadQuery, (snap) => {
          const counts = {};
          snap.docs.forEach(doc => {
              const msg = doc.data();
              const conversationId = msg.conversationId;
              counts[conversationId] = (counts[conversationId] || 0) + 1;
          });
          setUnreadCounts(counts);
      });

      return () => {
          unsub();
          unsubUnread();
      };
  }, [user, partnerProfiles]);

  // Listen to profile picture verification requests for blur detection
  useEffect(() => {
      if (!db) return;
      const q = query(collection(db, 'artifacts', getAppId(), 'private', 'data', 'profilePictureVerification'));
      const unsub = onSnapshot(q, (snap) => {
          const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setProfilePictureRequests(requests);
      });
      return () => unsub();
  }, []);

  const handleMarkAllRead = async () => {
      if (!db || !user) return;
      try {
          setIsMarkingAll(true);
          const now = serverTimestamp();
          await Promise.all(conversations.map(conv => {
              const ref = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conv.id, 'members', user.uid);
              return setDoc(ref, { memberId: user.uid, lastReadAt: now, lastDeliveredAt: now }, { merge: true });
          }));
          setUnreadCounts({});
      } catch (err) {
          console.error('Mark all read failed', err);
      } finally {
          setIsMarkingAll(false);
      }
  };

  const formatTime = (timestamp) => {
      if (!timestamp) return '';
      const date = timestamp.toDate();
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-900 to-white">
        <div className="p-6 border-b border-slate-700 bg-slate-900 flex items-center gap-4">
            <button 
                onClick={onClose} 
                className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                title="Close"
            >
                <X size={24} className="text-slate-300" />
            </button>
            <div className="flex-1">
                <h2 className="font-bold text-2xl text-slate-100">Messages</h2>
                <p className="text-sm text-slate-500 mt-1">{conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</p>
            </div>
            <button
                onClick={handleMarkAllRead}
                disabled={isMarkingAll || conversations.length === 0}
                className="text-xs font-bold px-3 py-2 rounded-full bg-slate-900 text-white hover:bg-slate-800 transition disabled:opacity-50"
            >
                {isMarkingAll ? 'Marking...' : 'Mark all read'}
            </button>
        </div>
        <div className="flex-1 overflow-y-auto">
             {conversations.length === 0 ? (
                 <div className="text-center text-slate-400 mt-20 px-6">
                     <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                         <MessageCircle size={40} className="text-slate-300" />
                     </div>
                     <h3 className="font-bold text-lg text-slate-300 mb-2">No messages yet</h3>
                     <p className="text-sm text-slate-500">Start a conversation from someone's profile in the Social tab</p>
                 </div>
             ) : (
                 <div className="divide-y divide-slate-100">
                     {conversations.map(conv => {
                         const partnerId = conv.participants.find(p => p !== user.uid);
                         const partner = partnerProfiles[partnerId] || {};
                         const unreadCount = unreadCounts[conv.id] || 0;
                         const hasUnread = unreadCount > 0;
                         
                         // Calculate blur status for partner
                         const isPending = profilePictureRequests.some(req => req.userId === partnerId && req.status === 'pending');
                         const shouldBlurPartner = partner?.blurPhotos || isPending;

                         return (
                             <div 
                                 key={conv.id} 
                                 className={`p-4 flex items-center gap-4 hover:bg-slate-900 transition-colors ${hasUnread ? 'bg-orange-900/20/50' : ''}`}
                             >
                                 {/* Profile Picture - Click to open profile */}
                                 <div 
                                     className="relative flex-shrink-0 cursor-pointer"
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         if (partner.uid) {
                                             onSelectProfile(partner, unreadCount);
                                         }
                                     }}
                                 >
                                    {partner.primaryPhoto || partner.photo ? (
                                      <div className="relative w-14 h-14">
                                        <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-br from-slate-200 via-white to-slate-200 shadow-inner">
                                          <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-100">
                                            <img
                                              src={partner.primaryPhoto || partner.photo}
                                              alt={partner.name || 'User'}
                                              className={`w-full h-full object-cover ${shouldBlurPartner ? 'blur-md scale-105' : ''}`}
                                            />
                                            {shouldBlurPartner && <div className="absolute inset-0 bg-slate-900/15" />}
                                          </div>
                                        </div>
                                        {shouldBlurPartner && (
                                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" />
                                        )}
                                      </div>
                                    ) : (
                                      <div className="w-14 h-14 flex items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 rounded-full border-2 border-white shadow-md hover:border-orange-500 transition-all">
                                        <User size={28} className="text-white"/>
                                      </div>
                                    )}
                                     {hasUnread && (
                                         <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-900/20 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                             {unreadCount > 9 ? '9+' : unreadCount}
                                         </div>
                                     )}
                                 </div>
                                 {/* Message Preview - Click to open chat directly */}
                                 <div 
                                     className="flex-1 min-w-0 cursor-pointer"
                                     onClick={() => onSelectChat(partner)}
                                 >
                                     <div className="flex items-center justify-between mb-1">
                                         <h4 className={`font-bold truncate ${hasUnread ? 'text-slate-100' : 'text-slate-300'}`}>
                                             {partner.name || partner.username || 'User'}
                                         </h4>
                                         <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                                             {formatTime(conv.lastMessageAt)}
                                         </span>
                                     </div>
                                     <p className={`text-sm truncate ${hasUnread ? 'text-slate-300 font-medium' : 'text-slate-500'}`}>
                                         {conv.lastMessage || 'Say hi! 👋'}
                                     </p>
                                 </div>
                             </div>
                         )
                     })}
                 </div>
             )}
        </div>
    </div>
  );
};

const ChatRoom = ({ user, partner, onBack, userProfile }) => {
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [showBlockConfirm, setShowBlockConfirm] = useState(false);
    const [conversationMeta, setConversationMeta] = useState({ blocked: false, violations: 0 });
    const [otherReceipts, setOtherReceipts] = useState({ lastDeliveredAt: null, lastReadAt: null });
    const receiptWriteRef = useRef({ delivered: 0, read: 0 });
    const [hasWorkConsent, setHasWorkConsent] = useState(partner?.role !== 'tradie');
    const [partnerProfile, setPartnerProfile] = useState(null);
    const [showSafetyToast, setShowSafetyToast] = useState(partner?.role === 'tradie');
    const [violationToast, setViolationToast] = useState('');
    const [profilePictureRequests, setProfilePictureRequests] = useState([]);
    const conversationId = [user.uid, partner.uid].sort().join('_'); 
    const scrollRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const effectivePartner = partnerProfile || partner;
    const partnerIsTradie = effectivePartner?.role === 'tradie';
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState('harassment');
    const [reportDetails, setReportDetails] = useState('');
    const [hasWink, setHasWink] = useState(partner?.hasWink || false);

    const handleWinkBack = async () => {
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                type: 'wink',
                userId: partner.uid,
                recipientId: partner.uid,
                senderId: user.uid,
                from: user.uid,
                fromName: userProfile?.name || 'User',
                fromPhoto: userProfile?.primaryPhoto || '',
                message: `${userProfile?.name || 'User'} winked back! 😉`,
                createdAt: serverTimestamp(),
                read: false
            });
            
            const q = query(
                collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'),
                where('type', '==', 'wink'),
                where('recipientId', '==', user.uid),
                where('senderId', '==', partner.uid)
            );
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            
            setHasWink(false);
            showToast?.('Winked back! 😉', 'success');
        } catch (e) {
            console.error(e);
            showToast?.('Failed to wink back', 'error');
        }
    };
    
    // Calculate blur status for partner - recalculates when partnerProfile or profilePictureRequests change
    const isPending = useMemo(() => {
        const pending = profilePictureRequests.some(req => req.userId === partner?.uid && req.status === 'pending');
        return pending;
    }, [profilePictureRequests, partner?.uid]);
    
    const shouldBlurPartner = useMemo(() => {
        const hasBlurPhotos = effectivePartner?.blurPhotos === true || partner?.blurPhotos === true;
        const isUnverified = effectivePartner?.verified === false || partner?.verified === false;
        return hasBlurPhotos || isPending || isUnverified;
    }, [effectivePartner?.blurPhotos, effectivePartner?.verified, partner?.blurPhotos, partner?.verified, isPending]);
    const handleReportSubmit = async () => {
        try {
            const recent = messages.slice(-10).map(m => ({
                text: m.text || '',
                imageUrl: m.imageUrl || '',
                senderId: m.senderId || '',
                createdAt: m.createdAt?.toMillis?.() || null
            }));
            await sendModerationReport({
                reporterUid: user?.uid,
                reporterName: user?.displayName || profile?.name || 'User',
                offenderUid: partner?.uid,
                offenderName: partner?.name || partner?.username || 'Unknown',
                conversationId,
                messageText: `${reportType}: ${reportDetails || 'No additional details'}`,
                senderId: user?.uid,
                messages: recent,
                participants: [user?.uid || '', partner?.uid || ''].filter(Boolean),
                type: reportType
            });
            setShowReportModal(false);
            setReportDetails('');
            setReportType('harassment');
            showToast?.('Report sent to admin for review.', 'success');
        } catch (err) {
            console.error('Report failed', err);
            showToast?.('Could not send report. Please try again.', 'error');
        }
    };

    const [isPartnerTyping, setIsPartnerTyping] = useState(false);
    const lastTypingSentRef = useRef(0);

    // Listen for partner typing
    useEffect(() => {
        if (!db || !conversationId) return;
        const convoRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
        const unsub = onSnapshot(convoRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const typingMap = data.typing || {};
                const partnerTypingTime = typingMap[partner.uid];
                
                if (partnerTypingTime) {
                    const now = Date.now();
                    const millis = partnerTypingTime.toMillis ? partnerTypingTime.toMillis() : partnerTypingTime;
                    const isTyping = now - millis < 5000;
                    
                    setIsPartnerTyping(prev => {
                        if (isTyping && !prev) soundService.playTyping();
                        return isTyping;
                    });
                } else {
                    setIsPartnerTyping(false);
                }
            }
        });
        return () => unsub();
    }, [conversationId, partner.uid]);

    const handleTyping = async () => {
        const now = Date.now();
        if (now - lastTypingSentRef.current > 2000) {
            lastTypingSentRef.current = now;
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId), {
                [`typing.${user.uid}`]: serverTimestamp()
            }).catch(() => {});
        }
    };

    type ReceiptStamp = Timestamp | Date | { toMillis?: () => number };
    const writeReceipt = useCallback(
        async (type: 'delivered' | 'read', stamp: ReceiptStamp, stampMs?: number) => {
            if (!db || !conversationId || !user?.uid || !stamp) return;
            const key = type === 'read' ? 'read' : 'delivered';
            const ms = stampMs || (stamp?.toMillis ? stamp.toMillis() : Date.now());
            if (ms && receiptWriteRef.current[key] && ms <= receiptWriteRef.current[key]) return;
            receiptWriteRef.current[key] = ms;
            const payload = { conversationId, uid: user.uid, timestamp: stamp };
            if (type === 'read') {
                await updateReadReceipts(payload);
            } else {
                await updateDeliveryReceipts(payload);
            }
        },
        [conversationId, user?.uid]
    );

    useEffect(() => {
        if (!db) return;
        
        // Listen to messages in this conversation
        const q = query(
            collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'),
            where('conversationId', '==', conversationId),
            orderBy('createdAt', 'asc')
        );
        
        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(d => ({id: d.id, ...d.data(), _animate: true}));
            setMessages(msgs);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100);

            // Play receive sound for new messages
            snap.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    if (data.senderId !== user.uid) {
                        const createdAt = data.createdAt?.toMillis?.() || Date.now();
                        if (Date.now() - createdAt < 10000) {
                            soundService.playReceive();
                        }
                    }
                }
            });

            if (!snap.docs.length) return;
            const newest = snap.docs[snap.docs.length - 1].data()?.createdAt || serverTimestamp();
            const newestMs = snap.docs[snap.docs.length - 1].data()?.createdAt?.toMillis?.() || Date.now();
            writeReceipt('delivered', newest, newestMs);
            writeReceipt('read', newest, newestMs);
        });
        
        return () => unsub();
    }, [user, partner, conversationId, writeReceipt]);

    // Mark unread messages as read when viewing this conversation
    useEffect(() => {
        if (!messages.length) return;
        const latest = messages[messages.length - 1]?.createdAt || serverTimestamp();
        const latestMs = messages[messages.length - 1]?.createdAt?.toMillis?.() || Date.now();
        writeReceipt('read', latest, latestMs);
    }, [messages, writeReceipt]);

    // Fetch profile picture verification requests for blur detection
    useEffect(() => {
        if (!db) return;
        const q = query(collection(db, 'artifacts', getAppId(), 'private', 'data', 'profilePictureVerification'));
        const unsub = onSnapshot(q, (snap) => {
            const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setProfilePictureRequests(requests);
        });
        return () => unsub();
    }, []);

    // Fetch partner profile to ensure we have full data including blurPhotos
    useEffect(() => {
        console.log('[ChatRoom] Component mounted/updated, partner.uid:', partner?.uid);
        const loadPartner = async () => {
            if (!db || !partner?.uid) {
                console.log('[ChatRoom] Skipping loadPartner - no db or partner.uid');
                return;
            }
            console.log('[ChatRoom] Loading partner profile from Firestore for:', partner.uid);
            try {
                const profileDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', partner.uid));
                if (profileDoc.exists()) {
                    const data = { uid: partner.uid, ...profileDoc.data() };
                    console.log('[ChatRoom] Partner profile loaded:', data.name, 'blurPhotos:', data.blurPhotos);
                    setPartnerProfile(data);
                    if (data.role === 'tradie') {
                        setHasWorkConsent(false);
                        setShowSafetyToast(true);
                    }
                } else {
                    console.log('[ChatRoom] Partner profile document does not exist');
                }
            } catch (error) {
                console.error('[ChatRoom] Failed to load partner profile for chat:', error);
            }
        };
        // Always load to ensure we have blurPhotos field
        loadPartner();
    }, [partner?.uid]);

    // Listen for conversation meta (blocked, violations)
    useEffect(() => {
        if (!db) return;
        const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
        const unsub = onSnapshot(conversationRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setConversationMeta({
                    blocked: data.workPolicyBlocked === true,
                    violations: data.workPolicyViolations || 0
                });
                const consentMap = data.workChatAgreements || {};
                setHasWorkConsent(partnerIsTradie ? consentMap[user.uid] === true : true);
            }
        });
        return () => unsub();
    }, [conversationId, partnerIsTradie, user.uid]);

    // Listen for other member receipts
    useEffect(() => {
        if (!db || !partner?.uid) return;
        const otherRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId, 'members', partner.uid);
        const unsub = onSnapshot(otherRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setOtherReceipts({
                    lastDeliveredAt: data.lastDeliveredAt || null,
                    lastReadAt: data.lastReadAt || null
                });
            }
        });
        return () => unsub();
    }, [db, conversationId, partner?.uid]);

    // Reset consent when partner role resolves

    const addSystemMessage = async (text) => {
        await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
            conversationId,
            senderId: 'system',
            recipientId: null,
            text,
            type: 'system',
            createdAt: serverTimestamp(),
            read: false
        });
    };

    const handleConsent = async () => {
        setHasWorkConsent(true);
        setShowSafetyToast(false);
        const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
        await setDoc(conversationRef, {
            workChatAgreements: { [user.uid]: true }
        }, { merge: true });
    };

    const sendMessage = async ({ imageUrl = null, thumbUrl = null, textOverride = null } = {}) => {
        const text = (textOverride ?? inputText).trim();
        if(!text && !imageUrl) return;
        if (conversationMeta.blocked) {
            alert('This chat is temporarily blocked pending admin review due to work-policy violations.');
            return;
        }
        if (partnerIsTradie && !hasWorkConsent) {
            alert('Please tap "I agree" in the work-safety banner to start chatting.');
            return;
        }
        
        // Check email verification - reload user first to get latest status
        if (user) {
            try {
                await user.reload();
                const updatedUser = auth.currentUser;
                const emailVerified = isEmailVerifiedForProfile(updatedUser, userProfile);
                
                if (!emailVerified) {
                    alert('Please verify your email before sending messages. Check your inbox for the verification link.');
                    return;
                }
            } catch (err) {
                console.error('Error checking verification:', err);
                // If reload fails, fall back to cached status
                if (!isEmailVerifiedForProfile(user, userProfile)) {
                    alert('Please verify your email before sending messages. Check your inbox for the verification link.');
                    return;
                }
            }
        }

        try {
            soundService.playSend();
            // Get current user data for notification
            const currentUserDoc = await getDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid));
            const currentUserData = currentUserDoc.data();
            if (currentUserData?.chatSuspended) {
                alert('Your chat access is temporarily suspended by an admin.');
                return;
            }

            if (!imageUrl) {
                setInputText('');
            }

            // Create/update conversation
            const conversationRef = doc(db, 'artifacts', getAppId(), 'public', 'data', 'conversations', conversationId);
            await setDoc(conversationRef, {
                participants: [user.uid, partner.uid],
                participantIds: [user.uid, partner.uid],
                lastMessage: imageUrl ? 'Photo' : text,
                lastMessageAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            }, { merge: true });

            // Work-policy moderation
            const violation = text ? detectWorkMessage(text.toLowerCase()) : null;
            const currentViolations = (conversationMeta?.violations || 0) + (violation ? 1 : 0);
            if (violation) {
                await setDoc(conversationRef, {
                    workPolicyViolations: currentViolations,
                    lastViolationAt: serverTimestamp()
                }, { merge: true });

                const warningText = buildWorkWarning(partnerIsTradie);
                setViolationToast('Work chats must go through Hire a Tradie. A warning was sent.');

                if (shouldBlockForWorkPolicy(currentViolations)) {
                    await setDoc(conversationRef, {
                        workPolicyBlocked: true,
                        blockedBy: 'system',
                        blockedReason: 'work_policy',
                        blockedAt: serverTimestamp()
                    }, { merge: true });

                    await sendModerationReport({
                        conversationId,
                        senderId: user.uid,
                        participants: [user.uid, partner.uid],
                        offenderUid: partner.uid,
                        offenderName: partner?.name || partner?.username || 'User',
                        reporterUid: user.uid,
                        reporterName: currentUserData?.name || currentUserData?.username || 'User',
                        messageText: text,
                        type: 'work_policy'
                    });

                    await addSystemMessage('Chat temporarily blocked for work-policy violations. An admin has been notified.');
                    return;
                } else {
                    await addSystemMessage(warningText);
                }
            }

            // Send message
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'messages'), {
                conversationId,
                senderId: user.uid,
                recipientId: partner.uid,
                text,
                imageUrl: imageUrl || null,
                thumbUrl: thumbUrl || null,
                createdAt: serverTimestamp(),
                read: false,
                type: imageUrl ? 'image' : 'user'
            });

            // Send notification
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'notifications'), {
                userId: partner.uid,
                type: 'message',
                from: user.uid,
                fromName: currentUserData?.name || currentUserData?.username || 'Someone',
                fromPhoto: currentUserData?.primaryPhoto || currentUserData?.photo || '',
                message: imageUrl ? 'Photo' : text,
                read: false,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleBlockUser = async () => {
        try {
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'blocked_users'), {
                blockedBy: user.uid,
                blockedUser: partner.uid,
                blockedUserName: partner.name || partner.username,
                blockedAt: serverTimestamp(),
                source: 'chat'
            });
            setShowBlockConfirm(false);
            onBack();
        } catch (error) {
            console.error("Error blocking user:", error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 z-[70] absolute inset-0">
            {/* Enhanced Header */}
            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900 shadow-sm">
                <button
                    onClick={() => window.open(`/profiles/${partner.uid}`, '_blank')}
                    className="flex items-center gap-2"
                    title="View profile"
                >
                    <div className="flex-shrink-0">
                        {partnerPhoto ? (
                            <div className="relative w-11 h-11 rounded-full p-[2px] bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 shadow-inner border-2 border-slate-800">
                                <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-800">
                                    <img 
                                        src={partnerPhoto} 
                                        alt={effectivePartner?.name || effectivePartner?.username || partner.name || partner.username} 
                                        className="w-full h-full object-cover"
                                        style={shouldBlurPartner ? { filter: 'blur(12px)', WebkitFilter: 'blur(12px)', opacity: 0.45, transform: 'scale(1.08)' } : {}}
                                    />
                                    {shouldBlurPartner && <div className="absolute inset-0 bg-slate-900/25" />}
                                    {shouldBlurPartner && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="bg-black/65 text-white rounded-full p-[5px] border border-white/20 shadow">
                                                {partnerUnverified ? <Shield size={12} /> : <Lock size={12} />}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 rounded-full border-2 border-slate-800 shadow-md">
                                <User size={20} className="text-white"/>
                            </div>
                        )}
                    </div>
                    <span className="font-bold text-lg text-slate-100 truncate">{partner.name || partner.username || 'User'}</span>
                </button>
                <div className="ml-auto flex items-center gap-1">
                    <div className="relative">
                        <button
                            onClick={() => setShowChatMenu(prev => !prev)}
                            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                            title="More"
                        >
                            <MoreHorizontal size={20} className="text-slate-300" />
                        </button>
                        {showChatMenu && (
                            <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden">
                                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 bg-slate-800 border-b border-slate-700">
                                    Quick actions
                                </div>
                                <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-800 flex items-center gap-2 border-b border-slate-800 text-slate-100"
                                    onClick={() => { setShowChatMenu(false); onBack(); }}
                                >
                                    <User size={14} className="text-slate-300" /> Profile
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-red-900/30 flex items-center gap-2 border-b border-slate-800 text-slate-100"
                                    onClick={() => { setShowChatMenu(false); setShowBlockConfirm(true); }}
                                >
                                    <Ban size={14} className="text-red-500" /> Block
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-amber-900/30 flex items-center gap-2 border-b border-slate-800 text-slate-100"
                                    onClick={() => { setShowChatMenu(false); setShowReportModal(true); }}
                                >
                                    <AlertCircle size={14} className="text-amber-500" /> Report
                                </button>
                                {partnerIsTradie && (
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-green-900/30 flex items-center gap-2 text-slate-100"
                                        onClick={() => { setShowChatMenu(false); logServiceIntent({ trade: effectivePartner?.trade || 'general', userId: user?.uid, source: 'chat_menu' }); alert('Hire flow coming soon'); }}
                                    >
                                        <HardHat size={14} className="text-green-400" /> Hire
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <button 
                        onClick={onBack}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors"
                        title="Close chat"
                    >
                        <X size={24} className="text-slate-300" />
                    </button>
                </div>
            </div>

            {/* Enhanced Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-slate-100 bg-slate-900">
                {showReportModal && (
                    <div className="fixed inset-0 bg-black/80 z-[120] flex items-end sm:items-center justify-center p-4">
                        <div className="bg-slate-900 w-full sm:w-[380px] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl">
                            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                                <h3 className="text-lg font-bold text-slate-100">Submit Report</h3>
                                <button onClick={() => setShowReportModal(false)} className="p-1 hover:bg-amber-100 rounded-full">
                                    <X className="w-5 h-5 text-slate-300" />
                                </button>
                            </div>
                            <div className="p-4 space-y-4 text-slate-100">
                                <p className="text-sm text-slate-300">
                                    We’ll review the last 10 messages and your notes. Reports are confidential and reviewed by admin.
                                </p>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Report Type</label>
                                    <select
                                        value={reportType}
                                        onChange={(e) => setReportType(e.target.value)}
                                        className="w-full p-3 border border-slate-600 rounded-lg text-sm"
                                    >
                                        <option value="harassment">Harassment</option>
                                        <option value="scam">Scam/Fraud</option>
                                        <option value="safety">Safety Concern</option>
                                        <option value="spam">Spam</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">Details</label>
                                    <textarea
                                        value={reportDetails}
                                        onChange={(e) => setReportDetails(e.target.value)}
                                        rows={4}
                                        placeholder="Describe what happened..."
                                        className="w-full p-3 border border-slate-700 bg-white text-black rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" className="flex-1" onClick={() => setShowReportModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button variant="danger" className="flex-1" onClick={handleReportSubmit}>
                                        Submit Report
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {hasWink && (
                    <div className="p-3 rounded-2xl bg-yellow-900/30 border border-yellow-500/50 flex items-center justify-between shadow-lg mb-4">
                        <div className="flex items-center gap-2 text-yellow-200 text-sm font-bold">
                            <span className="text-xl">😉</span>
                            Wink received, wank back?
                        </div>
                        <button
                            onClick={handleWinkBack}
                            className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold text-xs rounded-xl transition-colors shadow-sm"
                        >
                            Wank Back
                        </button>
                    </div>
                )}
                {partnerIsTradie && !conversationMeta.blocked && (
                    <div className="p-3 rounded-2xl border border-orange-700/50 bg-orange-900/20 shadow-sm text-sm text-orange-900 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-bold">Keep it flirty, don't talk about work 😉🪖</span>
                            <button
                                className="text-xs font-bold text-orange-300 underline"
                                onClick={() => logServiceIntent({ trade: effectivePartner?.trade || 'general', userId: user?.uid, source: 'chat_banner' })}
                            >
                                Hire this tradie
                            </button>
                        </div>
                        <p className="text-xs text-orange-800">
                            If you need work done, use our secure hiring feature. Tap below to confirm you agree to keep chats social only.
                        </p>
                        <button
                            onClick={handleConsent}
                            className={`w-full py-2 rounded-xl font-bold transition-all ${hasWorkConsent ? 'bg-green-900/30 text-green-200 border border-green-700/50' : 'bg-orange-600 text-white shadow-md hover:bg-orange-700'}`}
                        >
                            {hasWorkConsent ? 'You agreed to keep chat social' : 'I agree – enable chat'}
                        </button>
                    </div>
                )}

                {messages.map((m, i) => {
                    const isSystem = m.type === 'system' || m.senderId === 'system';
                    const isMine = m.senderId === user.uid;
                    const likes = m.likes || [];
                    const hasLiked = likes.includes(user.uid);

                    const handleLike = async () => {
                        if (!db || !m?.id || hasLiked) return;
                        try {
                            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'messages', m.id), {
                                likes: arrayUnion(user.uid)
                            });
                            setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, likes: Array.from(new Set([...(msg.likes || []), user.uid])) } : msg));
                        } catch (err) {
                            console.error('Failed to like message', err);
                        }
                    };

                    const handleTap = () => {
                        const now = Date.now();
                        if (now - (receiptWriteRef.current.lastTap || 0) < 300) {
                            handleLike();
                        }
                        receiptWriteRef.current.lastTap = now;
                    };

                    const bubbleClass = isSystem
                        ? 'bg-slate-900 border border-amber-200 text-slate-100 rounded-xl'
                        : isMine
                            ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-br-sm'
                            : 'bg-slate-900 border border-slate-700 text-slate-200 rounded-bl-sm';
                    return (
                        <div
                            key={i}
                            className={`flex gap-2 items-end ${isMine ? 'justify-end' : 'justify-start'} ${m._animate ? 'animate-popIn' : ''}`}
                            onDoubleClick={handleLike}
                            onTouchEnd={handleTap}
                        >
                            {!isMine && !isSystem && (
                                <div className="flex-shrink-0">
                                    {partnerPhoto ? (
                                        <div className="relative w-9 h-9 rounded-full p-[1.5px] bg-gradient-to-br from-slate-200 via-white to-slate-200 shadow-inner border border-white">
                                            <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-100">
                                                <img 
                                                    src={partnerPhoto} 
                                                    alt={effectivePartner?.name || effectivePartner?.username || partner.name || partner.username} 
                                                    className="w-full h-full object-cover"
                                                    style={shouldBlurPartner ? { filter: 'blur(12px)', WebkitFilter: 'blur(12px)', opacity: 0.45, transform: 'scale(1.08)' } : {}}
                                                />
                                                {shouldBlurPartner && <div className="absolute inset-0 bg-slate-900/15" />}
                                                {shouldBlurPartner && (
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="bg-black/55 text-white rounded-full p-[4px] border border-white/30 shadow">
                                                            {partnerUnverified ? <Shield size={11} /> : <Lock size={11} />}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-slate-300 to-slate-400 rounded-full border border-white shadow-sm">
                                            <User size={14} className="text-white"/>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="max-w-[75%] space-y-1">
                <div className={`p-3 rounded-2xl shadow-sm ${bubbleClass}`}>
                                    {m.imageUrl ? (
                                        <div onClick={() => window.open(m.imageUrl, '_blank')} className="cursor-zoom-in">
                                            <LazyImage src={m.thumbUrl || m.imageUrl} alt="Sent image" className="max-h-60 rounded-xl" />
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-relaxed">{m.text}</p>
                                    )}
                                </div>
                                {likes.length > 0 && !isSystem && (
                                    <div className={`flex items-center gap-1 text-[11px] font-semibold ${isMine ? 'justify-end text-white' : 'text-orange-300'}`}>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-900/20 text-orange-300 border border-orange-100 shadow-sm">
                                            ❤️ {likes.length}
                                        </span>
                                    </div>
                                )}
                                {isMine && !isSystem && (
                                    <div className="flex items-center justify-end gap-1 text-[11px] text-slate-500">
                                        {(() => {
                                            const createdMs = m.createdAt?.toMillis?.() || 0;
                                            const deliveredMs = otherReceipts?.lastDeliveredAt?.toMillis?.();
                                            const readMs = otherReceipts?.lastReadAt?.toMillis?.();
                                            const status = readMs && readMs >= createdMs
                                                ? 'Read'
                                                : deliveredMs && deliveredMs >= createdMs
                                                    ? 'Delivered'
                                                    : 'Sent';
                                            return (
                                                <>
                                                    <CheckCircle size={12} className="text-white" />
                                                    <span>{status}</span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                <div ref={scrollRef} />
            </div>

            {/* Enhanced Input Area */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3 shadow-lg">
                <input 
                    className="flex-1 p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm transition-all" 
                    style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
                    placeholder="Type a message..." 
                    value={inputText} 
                    onChange={e => { setInputText(e.target.value); handleTyping(); }} 
                    onKeyDown={e => e.key === 'Enter' && sendMessage()} 
                />
                <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !storage || uploadingImage) return;
                        try {
                            setUploadingImage(true);
                            const { blob, thumbBlob } = await processImageToWebP(file, { maxSizeBytes: 600 * 1024, maxWidth: 1280, thumbWidth: 320 });
                            const basePath = `artifacts/${getAppId()}/messages/${conversationId}/${Date.now()}`;
                            const refFull = storageRef(storage, `${basePath}_full.webp`);
                            const refThumb = storageRef(storage, `${basePath}_thumb.webp`);
                            const metadata = { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' };
                            await uploadBytes(refFull, blob, metadata);
                            await uploadBytes(refThumb, thumbBlob, metadata);
                            const [url, thumbUrl] = await Promise.all([getDownloadURL(refFull), getDownloadURL(refThumb)]);
                            await sendMessage({ imageUrl: url, thumbUrl, textOverride: '' });
                        } catch (err) {
                            console.error('Image send failed', err);
                        } finally {
                            setUploadingImage(false);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                        }
                    }}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="p-3 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                    title="Send image"
                >
                    <ImageIcon size={18} />
                </button>
                <button 
                    onClick={() => sendMessage()} 
                    disabled={!inputText.trim()}
                    className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-full hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Send size={18} />
                </button>
            </div>

            {/* Blocked banner */}
            {conversationMeta.blocked && (
                <div className="p-3 bg-red-900/20 text-red-300 text-sm text-center border-t border-red-100">
                    Chat blocked due to repeated work-policy violations. Admin review required.
                </div>
            )}

            {showSafetyToast && partnerIsTradie && !conversationMeta.blocked && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-xs w-[90%] bg-slate-900 text-white text-sm px-4 py-3 rounded-2xl shadow-2xl border border-orange-500/30">
                    Keep it flirty, don't talk about work 😉🪖. Tap "I agree" above to start chatting.
                </div>
            )}

            {violationToast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 max-w-xs w-[90%] bg-red-600 text-white text-sm px-4 py-3 rounded-2xl shadow-2xl">
                    {violationToast}
                </div>
            )}

            {/* Block Confirmation Modal */}
            {showBlockConfirm && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full">
                        <h3 className="text-lg font-bold text-slate-100 mb-2">Block User?</h3>
                        <p className="text-sm text-slate-300 mb-4">
                            You won't be able to message each other or see each other's profiles.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="ghost" className="flex-1" onClick={() => setShowBlockConfirm(false)}>
                                Cancel
                            </Button>
                            <Button variant="danger" className="flex-1" onClick={handleBlockUser}>
                                Block
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// UPDATED: UserProfile now accepts onEnableLocation to fix the button in view
const UserProfile = ({ user, profile, onLogout, showToast, onEnableLocation, onNavigate, profilePictureRequests = [] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});
    const [isVerifying, setIsVerifying] = useState(false); // Modal state for verification
    const [verificationDocs, setVerificationDocs] = useState({ front: null, back: null, selfie: null }); // Store verification docs
    const [isResendingVerification, setIsResendingVerification] = useState(false);
    const [isUploadingVerification, setIsUploadingVerification] = useState(false);
    const [verificationProgress, setVerificationProgress] = useState(0);
    const [verificationFeedback, setVerificationFeedback] = useState('');
    const photoInputRef = useRef(null);
    const verifyFrontRef = useRef(null);
    const verifyBackRef = useRef(null);
    const verifySelfieRef = useRef(null);

    useEffect(() => { if(profile) setEditData(profile); }, [profile]);
    useEffect(() => {
        if (!isVerifying) {
            setVerificationDocs(prev => {
                ['front', 'back', 'selfie'].forEach(key => {
                    const prevUrl = prev[key]?.preview;
                    if (prevUrl) URL.revokeObjectURL(prevUrl);
                });
                return { front: null, back: null, selfie: null };
            });
        }
    }, [isVerifying]);

    const isEmailVerified = !!(
        user?.emailVerified ||
        profile?.emailVerified === true ||
        profile?.emailVerifiedOverride === true
    );

    const handleSave = async () => {
        try {
            const updated = { ...editData };
            const desiredUsername = updated.username?.trim();
            const hasUsernameChange = desiredUsername && desiredUsername !== profile.username;
            if (hasUsernameChange) {
                const changesCount = profile?.usernameChanges || 0;
                if (changesCount >= 1) {
                    showToast?.('You can only change your username once.', 'error');
                    return;
                }
                const candidate = desiredUsername.replace(/^@/, '');
                const lower = candidate.toLowerCase();
                const snap = await getDocs(query(
                    collection(db, 'artifacts', getAppId(), 'public', 'data', 'profiles'),
                    where('usernameLower', '==', lower),
                    limit(1)
                ));
                if (!snap.empty && snap.docs[0].id !== user.uid) {
                    showToast?.('Username is taken. Please choose another.', 'error');
                    return;
                }
                updated.username = candidate;
                updated.usernameLower = lower;
                updated.usernameChanges = changesCount + 1;
            }

            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), updated);
            setIsEditing(false);
            showToast("Profile Updated!", "success");
        } catch (err) {
            console.error('Failed to save profile', err);
            showToast("Couldn't save profile. Try again.", "error");
        }
    };

    const handleVerificationCoverAction = async () => {
        if (!user || isEmailVerified || isResendingVerification) return;

        setIsResendingVerification(true);
        try {
            await user.reload();
            const updatedUser = auth.currentUser;

            if (updatedUser?.emailVerified || profile?.emailVerifiedOverride) {
                showToast?.('Email verified successfully!', 'success');
                setVerificationFeedback('Email verified — thanks for confirming.');
                return;
            }

            await sendEmailVerification(updatedUser || user);
            setVerificationFeedback('Verification email resent. Check your inbox.');
            showToast?.('Verification email sent! Check your inbox.', 'success');
        } catch (err) {
            console.error('Error with verification:', err);
            setVerificationFeedback('Unable to resend right now. Please try again or contact support.');
            if (err.code === 'auth/too-many-requests') {
                showToast?.('Too many requests. Please wait a few minutes.', 'error');
            } else {
                showToast?.('Failed to send email. Try again later.', 'error');
            }
        } finally {
            setIsResendingVerification(false);
        }
    };

    const handleVerificationCapture = async (file, key) => {
        if (!file) return;
        try {
            setIsUploadingVerification(true);
            const { blob, thumbBlob } = await processImageToWebP(file, { maxSizeBytes: 600 * 1024, maxWidth: 1600, thumbWidth: 400 });
            const preview = URL.createObjectURL(thumbBlob || blob);
            setVerificationDocs(prev => {
                // Revoke previous preview to avoid leaks
                const prevUrl = prev[key]?.preview;
                if (prevUrl) URL.revokeObjectURL(prevUrl);
                return { ...prev, [key]: { blob, thumbBlob, preview } };
            });
        } catch (err) {
            console.error('Verification image failed:', err);
            showToast('Failed to process photo. Try again.', 'error');
        } finally {
            setIsUploadingVerification(false);
        }
    };

    // UPDATED: Logic to handle Verification Request with Firebase Storage upload
    const handleVerifySubmit = async () => {
        if (!verificationDocs.front || !verificationDocs.back || !verificationDocs.selfie) {
            showToast("Please capture front, back, and a selfie", "error");
            return;
        }
        
        if (!storage) {
            showToast("Storage not initialized", "error");
            return;
        }
        
        try {
            setIsUploadingVerification(true);
            setVerificationProgress(10);
            showToast("Uploading documents securely...", "info");
            
            const frontBlob = verificationDocs.front?.blob;
            const backBlob = verificationDocs.back?.blob;
            const selfieBlob = verificationDocs.selfie?.blob;
            const frontThumbBlob = verificationDocs.front?.thumbBlob;
            const backThumbBlob = verificationDocs.back?.thumbBlob;
            const selfieThumbBlob = verificationDocs.selfie?.thumbBlob;
            
            const timestamp = Date.now();
            const frontFileName = `verifications/${user.uid}/cscs_front_${timestamp}.webp`;
            const backFileName = `verifications/${user.uid}/cscs_back_${timestamp}.webp`;
            const selfieFileName = `verifications/${user.uid}/selfie_${timestamp}.webp`;
            const frontThumbName = `verifications/${user.uid}/thumb_cscs_front_${timestamp}.webp`;
            const backThumbName = `verifications/${user.uid}/thumb_cscs_back_${timestamp}.webp`;
            const selfieThumbName = `verifications/${user.uid}/thumb_selfie_${timestamp}.webp`;
            
            const frontRef = storageRef(storage, frontFileName);
            const backRef = storageRef(storage, backFileName);
            const selfieRef = storageRef(storage, selfieFileName);
            const frontThumbRef = storageRef(storage, frontThumbName);
            const backThumbRef = storageRef(storage, backThumbName);
            const selfieThumbRef = storageRef(storage, selfieThumbName);
            
            await uploadBytes(frontRef, frontBlob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
            setVerificationProgress(35);
            await uploadBytes(backRef, backBlob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
            setVerificationProgress(65);
            await uploadBytes(selfieRef, selfieBlob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
            setVerificationProgress(80);

            // Upload thumbnails for lightweight previews
            if (frontThumbBlob) await uploadBytes(frontThumbRef, frontThumbBlob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
            if (backThumbBlob) await uploadBytes(backThumbRef, backThumbBlob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
            if (selfieThumbBlob) await uploadBytes(selfieThumbRef, selfieThumbBlob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
            
            const frontUrl = await getDownloadURL(frontRef);
            const backUrl = await getDownloadURL(backRef);
            const selfieUrl = await getDownloadURL(selfieRef);
            const frontThumbUrl = frontThumbBlob ? await getDownloadURL(frontThumbRef) : null;
            const backThumbUrl = backThumbBlob ? await getDownloadURL(backThumbRef) : null;
            const selfieThumbUrl = selfieThumbBlob ? await getDownloadURL(selfieThumbRef) : null;
            setVerificationProgress(90);
            
            // Create verification request in Firestore
            await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'verification_requests'), {
                tradieUid: user.uid,
                tradieName: profile.name || profile.username,
                trade: profile.trade || 'Not specified',
                cardImageUrl: frontUrl, // Primary image for preview
                cardImageBackUrl: backUrl,
                selfieUrl,
                cardImageThumbUrl: frontThumbUrl,
                cardImageBackThumbUrl: backThumbUrl,
                selfieThumbUrl,
                status: 'pending',
                createdAt: serverTimestamp(),
                notes: `Trade: ${profile.trade || 'Not specified'}`
            });
            
            // Update profile to indicate verification is pending
            await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                verificationStatus: 'pending',
                verificationRequestedAt: serverTimestamp()
            });
            setVerificationProgress(100);
            
            setIsVerifying(false);
            setVerificationDocs({ front: null, back: null, selfie: null });
            showToast("Verification request submitted!", "success");
        } catch (error) {
            console.error("Error submitting verification:", error);
            showToast("Failed to submit verification request", "error");
        } finally {
            setIsUploadingVerification(false);
            setVerificationProgress(0);
        }
    };

    useEffect(() => {
        return () => {
            setVerificationDocs(prev => {
                ['front', 'back', 'selfie'].forEach(key => {
                    const prevUrl = prev[key]?.preview;
                    if (prevUrl) URL.revokeObjectURL(prevUrl);
                });
                return prev;
            });
        };
    }, []);

    const handleVerificationUpload = async (e, side) => {
        e?.preventDefault?.();
        const file = e.target.files?.[0];
        if (!file) {
            e.target.value = '';
            return;
        }
        await handleVerificationCapture(file, side);
        e.target.value = '';
    };

    const handleImageUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Show loading state
        showToast("Compressing and uploading image...", "info");
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                let imageData = event.target.result;
                
                // Compress to 30KB target size for better quality
                imageData = await compressImage(imageData, 30 * 1024); // 30KB
                
                // Update local state first
                setEditData(prev => ({...prev, [field]: imageData}));
                
                // Save to Firebase
                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                    [field]: imageData
                });
                
                // If uploading primary photo, create verification request
                if (field === 'primaryPhoto') {
                    await addDoc(collection(db, 'artifacts', getAppId(), 'public', 'data', 'profile_picture_requests'), {
                        userId: user.uid,
                        username: profile.username || profile.name || 'Unknown',
                        name: profile.name || profile.username || 'Unknown',
                        photoData: imageData,
                        status: 'pending',
                        createdAt: new Date(),
                        uploadedAt: new Date()
                    });
                    showToast("Profile picture uploaded! Pending admin review.", "info");
                } else {
                    showToast("Image uploaded successfully!", "success");
                }
            } catch (error) {
                console.error("Error uploading image:", error);
                showToast("Failed to upload image", "error");
            }
        };
        reader.readAsDataURL(file);
    };
    
    // Helper function to compress images to target size
    const compressImage = (base64Image, targetSizeBytes) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Estimate current size and calculate aggressive scaling if needed
                const currentSize = base64Image.length * BASE64_SIZE_RATIO;
                
                // Start with aggressive downscaling for small targets
                if (currentSize > targetSizeBytes) {
                    // Adjusted scaling for 30KB target - allows better quality
                    const scaleFactor = Math.sqrt(targetSizeBytes / currentSize) * 0.85;
                    width = Math.max(100, Math.floor(width * scaleFactor)); // Minimum 100px for profile pics
                    height = Math.max(100, Math.floor(height * scaleFactor));
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress with quality adjustment to hit target size
                let quality = 0.8; // Start with higher quality for 30KB target
                let compressedData = canvas.toDataURL('image/jpeg', quality);
                
                // Reduce quality until we're under target size
                while (compressedData.length * BASE64_SIZE_RATIO > targetSizeBytes && quality > 0.05) {
                    quality -= 0.05;
                    compressedData = canvas.toDataURL('image/jpeg', quality);
                }
                
                resolve(compressedData);
            };
            img.src = base64Image;
        });
    };

    if (!profile) return null;

    return (
        <div className="p-4 pb-20 relative">
            {/* UPDATED: Verification Modal */}
            {isVerifying && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in">
                        <div className="flex justify-between items-center mb-4">
                             <h3 className="text-xl font-black text-slate-100">Verify Trade ID</h3>
                             <button onClick={() => { setIsVerifying(false); setVerificationDocs({ front: null, back: null, selfie: null }); }}>
                                <X className="text-slate-400 hover:text-slate-300" />
                             </button>
                        </div>
                        <p className="text-sm text-slate-300 mb-6">Use your camera to capture the front and back of your Trade ID card, then take a quick selfie.</p>
                        
                        <button 
                            type="button"
                            onClick={() => verifyFrontRef.current?.click()}
                            className="w-full border-2 border-dashed border-slate-700 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400 mb-4 bg-slate-900 hover:border-orange-500 hover:bg-orange-900/20 transition-all overflow-hidden"
                        >
                             {verificationDocs.front ? (
                                <div className="relative w-full h-full">
                                    <img src={verificationDocs.front.preview} alt="Front preview" className="absolute inset-0 w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-white">
                                        <CheckCircle className="mb-2 text-green-200" size={28} />
                                        <span className="text-xs font-bold">Front captured (tap to retake)</span>
                                    </div>
                                </div>
                             ) : (
                                <>
                                    <Camera size={32} className="mb-2" />
                                    <span className="text-xs font-bold">Tap to Capture Front</span>
                                </>
                             )}
                        </button>
                        
                        <button 
                            type="button"
                            onClick={() => verifyBackRef.current?.click()}
                            className="w-full border-2 border-dashed border-slate-700 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400 mb-6 bg-slate-900 hover:border-orange-500 hover:bg-orange-900/20 transition-all overflow-hidden"
                        >
                             {verificationDocs.back ? (
                                <div className="relative w-full h-full">
                                    <img src={verificationDocs.back.preview} alt="Back preview" className="absolute inset-0 w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-white">
                                        <CheckCircle className="mb-2 text-green-200" size={28} />
                                        <span className="text-xs font-bold">Back captured (tap to retake)</span>
                                    </div>
                                </div>
                             ) : (
                                <>
                                    <Camera size={32} className="mb-2" />
                                    <span className="text-xs font-bold">Tap to Capture Back</span>
                                </>
                             )}
                        </button>

                        <button 
                            type="button"
                            onClick={() => verifySelfieRef.current?.click()}
                            className="w-full border-2 border-dashed border-slate-700 rounded-xl h-32 flex flex-col items-center justify-center text-slate-400 mb-6 bg-slate-900 hover:border-orange-500 hover:bg-orange-900/20 transition-all overflow-hidden"
                        >
                             {verificationDocs.selfie ? (
                                <div className="relative w-full h-full">
                                    <img src={verificationDocs.selfie.preview} alt="Selfie preview" className="absolute inset-0 w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/35 flex flex-col items-center justify-center text-white">
                                        <CheckCircle className="mb-2 text-green-200" size={28} />
                                        <span className="text-xs font-bold">Selfie captured (tap to retake)</span>
                                    </div>
                                </div>
                             ) : (
                                <>
                                    <Camera size={32} className="mb-2" />
                                    <span className="text-xs font-bold">Tap to Capture Selfie</span>
                                </>
                             )}
                        </button>
                        
                        <input type="file" ref={verifyFrontRef} onChange={(e) => handleVerificationUpload(e, 'front')} accept="image/*" capture="environment" className="hidden" />
                        <input type="file" ref={verifyBackRef} onChange={(e) => handleVerificationUpload(e, 'back')} accept="image/*" capture="environment" className="hidden" />
                        <input type="file" ref={verifySelfieRef} onChange={(e) => handleVerificationUpload(e, 'selfie')} accept="image/*" capture="user" className="hidden" />

                        {isUploadingVerification && (
                            <div className="mb-4">
                                <div className="flex justify-between text-xs text-slate-400 mb-1">
                                    <span>Uploading...</span>
                                    <span>{verificationProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all"
                                        style={{ width: `${verificationProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <Button 
                            onClick={handleVerifySubmit} 
                            className="w-full"
                            variant={verificationDocs.front && verificationDocs.back && verificationDocs.selfie ? "secondary" : "primary"}
                            disabled={!verificationDocs.front || !verificationDocs.back || !verificationDocs.selfie || isUploadingVerification}
                        >
                            {isUploadingVerification ? 'Uploading...' : 'Submit for Review'}
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex flex-col items-center mb-6 relative">
                <button onClick={() => setIsEditing(!isEditing)} className="absolute right-0 top-0 p-2 text-slate-400 hover:text-orange-500 z-10"><Edit2 size={20} /></button>
                
                {/* Cover Photo Area (Preview) - Now uses default cover photo */}
                <div
                    className={`w-full h-36 bg-slate-700 mb-8 rounded-2xl relative overflow-hidden group border border-slate-600 shadow-xl ${user && !isEmailVerified ? 'cursor-pointer' : ''}`}
                    onClick={user && !isEmailVerified ? handleVerificationCoverAction : undefined}
                    role={user && !isEmailVerified ? 'button' : undefined}
                    tabIndex={user && !isEmailVerified ? 0 : -1}
                    aria-label={user && !isEmailVerified ? 'Resend verification email' : undefined}
                >
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-orange-500/40 via-pink-500/30 to-purple-500/30 blur-sm opacity-80 animate-pulse-slow" aria-hidden />
                    <div
                        className="absolute inset-0 opacity-70 mix-blend-screen pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,166,43,0.18), transparent 32%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.12), transparent 28%), radial-gradient(circle at 60% 70%, rgba(59,130,246,0.16), transparent 30%)'
                        }}
                    />
                    <img src={getDefaultCoverPhoto(user?.email, profile.role)} className="w-full h-full object-cover scale-[1.02]" alt="Cover"/>

                </div>

                <div className={`relative mb-3 group -mt-16 ${!isEditing ? 'cursor-pointer' : ''}`} onClick={() => !isEditing && setIsEditing(true)}>
                    <Avatar profile={isEditing ? editData : profile} size="xl" className="shadow-lg border-4 border-white w-24 h-24" showEditIcon={!isEditing} profilePictureRequests={profilePictureRequests} />
                    
                    {/* Busy/DND Badge */}
                    {profile.role === 'tradie' && !isEditing && (() => {
                        const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                        if (currentlyUnavailable) {
                            return (
                                <div className="absolute -bottom-1 -right-1 bg-red-900/20 text-white p-1.5 rounded-full shadow-lg border-2 border-white" title="Currently Unavailable">
                                    <Ban size={14} />
                                </div>
                            );
                        }
                        return null;
                    })()}
                    
                    {isEditing && (
                        <button onClick={() => photoInputRef.current?.click()} className="absolute bottom-0 right-0 bg-orange-900/20 text-white p-2 rounded-full shadow-md hover:bg-orange-600 transition-colors border-2 border-white"><Camera size={16} /></button>
                    )}
                    <input type="file" ref={photoInputRef} onChange={(e) => handleImageUpload(e, 'primaryPhoto')} accept="image/*" className="hidden" />
                </div>
                
                {isEditing ? (
                    <div className="w-full space-y-3 animate-in fade-in duration-300">
                        <Input label="Name" value={editData.name || editData.username} onChange={e => setEditData({...editData, name: e.target.value})} />
                        <div className="flex items-center gap-2">
                            <Input 
                                label="Username" 
                                value={editData.username || ''} 
                                onChange={e => setEditData({...editData, username: e.target.value})} 
                                disabled={(profile?.usernameChanges || 0) >= 1}
                            />
                            <div className="text-[11px] text-slate-500 font-semibold">
                                {(profile?.usernameChanges || 0) >= 1 ? 'Username change used' : 'One change allowed'}
                            </div>
                        </div>
                        <Input label="Bio" textarea value={editData.bio} onChange={e => setEditData({...editData, bio: e.target.value})} />
                        {profile.role === 'tradie' && <Input label="Hourly Rate" type="number" value={editData.rate} onChange={e => setEditData({...editData, rate: e.target.value})} />}
                        
                        <div className="bg-slate-800 p-3 rounded-lg flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-300">GPS Location</span>
                            <button onClick={onEnableLocation} className="text-xs bg-slate-900 text-white px-3 py-2 rounded flex items-center gap-1"><Navigation size={12}/> Update</button>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button variant="ghost" className="flex-1" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button variant="secondary" className="flex-1" onClick={handleSave}>Save Changes</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <h2 className="text-2xl font-black flex items-center gap-2 text-slate-100">
                            <span>{profile.name || profile.username}{profile.hideAge ? '' : `, ${profile.age}`}</span>
                            {profile.email === ADMIN_EMAIL ? (
                                <span className="p-1.5 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 border border-white/40 shadow-lg shadow-purple-300/60">
                                    <Shield size={16} className="text-white fill-white drop-shadow" />
                                </span>
                            ) : (
                                profile.verified && <ShieldCheck size={20} className="text-blue-500 fill-blue-100" />
                            )}
                        </h2>
                        {profile.username && (
                            <p className="text-xs font-bold text-orange-300">@{profile.username}</p>
                        )}
                        <p className="text-slate-500 text-sm capitalize font-medium">{profile.role} • {profile.location}</p>
                        {profile.role === 'tradie' && <p className="font-mono text-slate-200 font-bold mt-1">£{profile.rate}/hr</p>}
                        <p className="text-center text-slate-300 mt-3 text-sm max-w-xs leading-relaxed">{profile.bio}</p>
                        
                        {/* Not Available Banner for Tradies */}
                        {profile.role === 'tradie' && (() => {
                            const currentlyUnavailable = isCurrentlyUnavailable(profile.workCalendar);
                            if (currentlyUnavailable) {
                                const unavailabilityInfo = getCurrentUnavailabilityInfo(profile.workCalendar);
                                const nextAvailable = getNextAvailableDateTime(profile.workCalendar);
                                const isOnJob = unavailabilityInfo?.reason === 'job';
                                
                                if (nextAvailable) {
                                    return (
                                        <div className={`mt-4 w-full border-2 rounded-xl p-3 ${isOnJob ? 'bg-blue-900/20 border-blue-700/50' : 'bg-red-900/20 border-red-700/50'}`}>
                                            <div className="flex items-center gap-2 justify-center">
                                                <Ban size={16} className={isOnJob ? 'text-blue-400' : 'text-red-400'} />
                                                <div className="text-center">
                                                    <p className={`text-xs font-bold ${isOnJob ? 'text-blue-100' : 'text-red-900'}`}>
                                                        {isOnJob ? "On a job! I'll be available for Hire from:" : "Not Available for Hire until:"}
                                                    </p>
                                                    <p className={`text-sm font-black ${isOnJob ? 'text-blue-300' : 'text-red-300'}`}>
                                                        {nextAvailable.date.toLocaleDateString('en-GB', { 
                                                            weekday: 'short',
                                                            month: 'short', 
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })} at {formatTimeSlot(nextAvailable.timeSlot)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            return null;
                        })()}
                    </>
                )}
                
                {/* UPDATED: Verify Button Logic */}
                {profile.role === 'tradie' && !profile.verified && (
                    <div className="mt-4 w-full bg-slate-800 p-4 rounded-xl border border-slate-700 text-center">
                        {profile.verificationStatus === 'pending_review' ? (
                            <>
                                <div className="mx-auto bg-yellow-100 w-10 h-10 rounded-full flex items-center justify-center mb-2"><CheckCircle className="text-yellow-600" size={20} /></div>
                                <p className="text-sm font-bold text-slate-300">Verification Pending</p>
                                <p className="text-xs text-slate-400">We are reviewing your ID documents.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-slate-300 mb-2">Get Verified & Boost Bookings</p>
                                <Button onClick={() => setIsVerifying(true)} variant="primary" className="w-full text-sm py-2">Verify Trade ID</Button>
                            </>
                        )}
                    </div>
                )}
                
                {/* Verification Approval Notification */}
                {profile.notifications && profile.notifications.some(n => n.type === 'verification_approved' && !n.read) && (
                    <div className="mt-4 w-full bg-green-900/20 border-2 border-green-500 p-4 rounded-xl animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <div className="bg-green-900/200 text-white p-2 rounded-full flex-shrink-0">
                                <CheckCircle size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-green-100 text-sm">Verification Approved!</h4>
                                <p className="text-xs text-green-200 mt-1">
                                    Your tradie verification has been approved. You now have a verified badge on your profile.
                                </p>
                                <button
                                    onClick={async () => {
                                        // Mark notification as read
                                        const updatedNotifications = profile.notifications.map(n =>
                                            n.type === 'verification_approved' ? { ...n, read: true } : n
                                        );
                                        await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                            notifications: updatedNotifications
                                        });
                                    }}
                                    className="mt-2 text-xs font-bold text-green-200 hover:text-green-100 underline"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Email Verification Notification */}
                {user && !isEmailVerified && (
                    <div className="mt-4 w-full bg-orange-900/20 border-2 border-orange-500 p-4 rounded-xl animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <div className="bg-orange-900/20 text-white p-2 rounded-full flex-shrink-0">
                                <Mail size={18} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-orange-900 text-sm">Email verification needed</h4>
                                <p className="text-xs text-orange-800 mt-1 font-medium">
                                    Access stays limited until your email is verified.
                                </p>
                                {verificationFeedback && (
                                    <p className="text-[11px] text-orange-900 mt-2 bg-slate-900/60 border border-orange-700/50 rounded-md px-2 py-1">
                                        {verificationFeedback}
                                    </p>
                                )}
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={handleVerificationCoverAction}
                                        className="text-xs font-bold bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 transition-colors"
                                    >
                                        Resend verification email
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin Message Notification (moved off cover) */}
                {profile?.adminCoverMessage?.text && (
                    <div className="mt-4 w-full bg-blue-900/20 border-2 border-blue-500 p-4 rounded-xl animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <div className="bg-blue-900/200 text-white p-2 rounded-full flex-shrink-0">
                                <AlertCircle size={18} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-blue-100 text-sm">Admin Message</h4>
                                <p className="text-xs text-blue-200 mt-1 font-medium">
                                    {profile.adminCoverMessage.text}
                                </p>
                                <div className="flex gap-2 mt-3">
                                    <button
                                        onClick={async () => {
                                            try {
                                                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                                    adminCoverMessage: deleteField()
                                                });
                                            } catch (err) {
                                                console.error('Error dismissing message:', err);
                                                showToast('Could not dismiss message', 'error');
                                            }
                                        }}
                                        className="text-xs font-bold text-blue-300 hover:text-blue-100 underline"
                                    >
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verification Rejection Notification */}
                {profile.notifications && profile.notifications.some(n => n.type === 'verification_rejected' && !n.read) && (() => {
                    const rejectionNotif = profile.notifications.find(n => n.type === 'verification_rejected' && !n.read);
                    return (
                        <div className="mt-4 w-full bg-red-900/20 border-2 border-red-500 p-4 rounded-xl animate-in fade-in">
                            <div className="flex items-start gap-3">
                                <div className="bg-red-900/20 text-white p-2 rounded-full flex-shrink-0">
                                    <X size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-red-900 text-sm">Verification Rejected</h4>
                                    <p className="text-xs text-red-800 mt-1 font-medium">
                                        Reason: {rejectionNotif.message}
                                    </p>
                                    <p className="text-xs text-red-300 mt-2">
                                        Please review the feedback and submit again with corrected documents.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => setIsVerifying(true)}
                                            className="text-xs font-bold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                            Resubmit Documents
                                        </button>
                                        <button
                                            onClick={async () => {
                                                // Mark notification as read
                                                const updatedNotifications = profile.notifications.map(n =>
                                                    n.type === 'verification_rejected' ? { ...n, read: true } : n
                                                );
                                                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                                    notifications: updatedNotifications
                                                });
                                            }}
                                            className="text-xs font-bold text-red-300 hover:text-red-900 underline"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* Profile Picture Rejection Notification */}
                {profile.notifications && profile.notifications.some(n => n.type === 'profile_picture_rejected' && !n.read) && (() => {
                    const rejectionNotif = profile.notifications.find(n => n.type === 'profile_picture_rejected' && !n.read);
                    return (
                        <div className="mt-4 w-full bg-slate-900 border-2 border-amber-500 p-4 rounded-xl animate-in fade-in">
                            <div className="flex items-start gap-3">
                                <div className="bg-slate-9000 text-white p-2 rounded-full flex-shrink-0">
                                    <ImageIcon size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-slate-100 text-sm">Profile Picture Rejected</h4>
                                    <p className="text-xs text-amber-800 mt-1 font-medium">
                                        Reason: {rejectionNotif.message}
                                    </p>
                                    <p className="text-xs text-amber-700 mt-2">
                                        Please upload a different profile picture that meets our guidelines.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <button
                                            onClick={() => {
                                                setIsEditing(true);
                                                // Auto-scroll or focus on photo upload
                                            }}
                                            className="text-xs font-bold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors"
                                        >
                                            Upload New Photo
                                        </button>
                                        <button
                                            onClick={async () => {
                                                // Mark notification as read
                                                const updatedNotifications = profile.notifications.map(n =>
                                                    n.type === 'profile_picture_rejected' ? { ...n, read: true } : n
                                                );
                                                await updateDoc(doc(db, 'artifacts', getAppId(), 'public', 'data', 'profiles', user.uid), {
                                                    notifications: updatedNotifications
                                                });
                                            }}
                                            className="text-xs font-bold text-amber-700 hover:text-slate-100 underline"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })()}
            </div>
            <div className="space-y-2 mb-8">
                <ProfileLink icon={Settings} label="Settings" onClick={() => onNavigate('settings')} />
                {profile.role === 'tradie' && (
                    <ProfileLink icon={Calendar} label="Work Calendar" onClick={() => onNavigate('workCalendar')} />
                )}
                {profile.role === 'tradie' && (
                    <ProfileLink icon={DollarSign} label="Payments & Credits" onClick={() => onNavigate('paymentsCredits')} />
                )}
                <ProfileLink icon={ShieldCheck} label="Safety Centre" onClick={() => onNavigate('safety')} />
                <button onClick={onLogout} className="w-full p-4 flex items-center gap-3 text-red-500 hover:bg-red-900/20 rounded-xl transition-colors font-bold"><LogOut size={20} /> <span className="font-medium">Sign Out</span></button>
            </div>
        </div>
    );
};

const ProfileLink = ({ icon: Icon, label, onClick }) => (
    <button onClick={onClick} className="w-full p-4 flex items-center justify-between bg-slate-900 border border-slate-100 rounded-xl shadow-sm hover:border-slate-600 transition-all group">
        <div className="flex items-center gap-3 text-slate-300 font-medium group-hover:text-slate-100"><Icon size={20} /> <span>{label}</span></div><ArrowRight size={16} className="text-slate-400 group-hover:text-slate-300" />
    </button>
);





export { 
  Shop, 
   
  JobRequestForm, 
  JobManager, 
  MessagesModal, 
  WinksList, 
  ChatList, 
  ChatRoom, 
  UserProfile, 
  ProfileLink 
};
