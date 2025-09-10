import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown, Star, Zap, Shield, Award, ArrowRight } from 'lucide-react';

const plans = [
  {
    id: 'basic',
    title: 'Starter',
    price: 'Free',
    period: '15-day trial',
    features: [
      '1 Agent account',
      '100 Lead capacity',
      'Basic CRM features',
      'Email support',
      'Standard analytics'
    ],
    limitations: [
      'No custom branding',
      'Limited integrations'
    ],
    bgColor: 'bg-white',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-600',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    popular: false,
    icon: <Award className="w-6 h-6" />
  },
  {
    id: 'standard',
    title: 'Professional',
    price: '$19',
    period: 'per month',
    features: [
      '5 Agent accounts',
      '1,000 Lead capacity',
      'Advanced CRM features',
      'Priority support',
      'Email + SMS campaigns',
      'Advanced analytics',
      'Custom branding'
    ],
    limitations: [],
    bgColor: 'bg-gradient-to-b from-blue-50 to-white',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-700',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    popular: true,
    icon: <Zap className="w-6 h-6" />
  },
  {
    id: 'pro',
    title: 'Business',
    price: '$49',
    period: 'per month',
    features: [
      '15 Agent accounts',
      '5,000 Lead capacity',
      'All Professional features',
      '24/7 priority support',
      'Advanced automations',
      'Custom integrations',
      'API access',
      'Team management'
    ],
    limitations: [],
    bgColor: 'bg-gradient-to-b from-blue-100 to-white',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-800',
    buttonColor: 'bg-blue-700 hover:bg-blue-800',
    popular: true,
    icon: <Crown className="w-6 h-6" />
  },
  {
    id: 'enterprise',
    title: 'Enterprise',
    price: 'Custom',
    period: 'tailored solution',
    features: [
      'Unlimited agents',
      'Unlimited leads',
      'Dedicated account manager',
      'Custom development',
      'White-label solution',
      'SLA guarantee',
      'Onboarding assistance',
      'Premium support'
    ],
    limitations: [],
    bgColor: 'bg-gradient-to-b from-blue-200 to-white',
    borderColor: 'border-blue-600',
    textColor: 'text-blue-900',
    buttonColor: 'bg-blue-800 hover:bg-blue-900',
    popular: false,
    icon: <Shield className="w-6 h-6" />
  }
];

const PlanModal = ({ isOpen, onClose, trialEndTime = null, isBlocking = false }) => {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isHovering, setIsHovering] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState('');

  // Calculate time remaining for trial
  useEffect(() => {
    if (trialEndTime) {
      const interval = setInterval(() => {
        const now = Date.now();
        const remaining = trialEndTime - now;
        
        if (remaining <= 0) {
          setTimeRemaining('Trial expired');
          clearInterval(interval);
          return;
        }
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [trialEndTime]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const handlePlanSelect = (planId) => {
    setSelectedPlan(planId);
    // Here you would typically handle the plan selection (payment processing, etc.)
    console.log('Selected plan:', planId);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Overlay */}
        <motion.div  
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={isBlocking ? undefined : onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        ></motion.div>

        {/* Modal */}
        <motion.div 
          className="relative w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 relative">
            <div className="text-center">
              <motion.h2 
                className="text-3xl font-bold mb-2"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                Upgrade Your CRM Experience
              </motion.h2>
              <motion.p 
                className="text-blue-100 max-w-2xl mx-auto"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {trialEndTime ? 'Your trial period has ended. Choose a plan to continue accessing all features.' : 'Choose a plan that works best for your business'}
              </motion.p>
              
              {timeRemaining && (
                <motion.div 
                  className="mt-4 inline-flex items-center bg-white/20 px-4 py-2 rounded-full text-sm"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="mr-2">⏰</span>
                  <span className="font-medium">{timeRemaining} remaining</span>
                </motion.div>
              )}
            </div>

            {/* Close Button - Always Visible */}
            <motion.button 
              onClick={onClose}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              whileHover={{ rotate: 90, scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-6 h-6" />
            </motion.button>
          </div>

          {/* Plans Grid */}
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {plans.map((plan, idx) => (
                <motion.div
                  key={plan.id}
                  className={`relative rounded-xl border-2 ${plan.borderColor} p-6 ${plan.bgColor} flex flex-col h-full transition-all duration-300 ${
                    isHovering === idx ? 'shadow-lg transform scale-105' : 'shadow-md'
                  } ${plan.popular ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}`}
                  whileHover={{ y: -5 }}
                  onHoverStart={() => setIsHovering(idx)}
                  onHoverEnd={() => setIsHovering(null)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  {/* Popular Badge */}
                  {plan.popular && (
                    <motion.div 
                      className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-xs font-bold px-4 py-1 rounded-full flex items-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.3 }}
                    >
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      MOST POPULAR
                    </motion.div>
                  )}
                  
                  {/* Plan Icon */}
                  <div className={`w-12 h-12 rounded-full ${plan.textColor} bg-opacity-20 flex items-center justify-center mb-4`}>
                    {plan.icon}
                  </div>
                  
                  {/* Plan Title */}
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.title}</h3>
                  
                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm text-gray-600 ml-1">/{plan.period}</span>
                    )}
                  </div>
                  
                  {/* Features List */}
                  <ul className="mb-6 space-y-3 flex-grow">
                    {plan.features.map((feature, fIdx) => (
                      <motion.li 
                        key={fIdx} 
                        className="text-gray-700 flex items-start"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + (fIdx * 0.1) }}
                      >
                        <Check className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>
                  
                  {/* Limitations */}
                  {plan.limitations.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 font-medium mb-2">Limitations:</p>
                      <ul className="space-y-1">
                        {plan.limitations.map((limitation, lIdx) => (
                          <li key={lIdx} className="text-xs text-gray-500 flex items-start">
                            <X className="w-3 h-3 text-red-400 mr-1 mt-0.5" />
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Select Button */}
                  <motion.button 
                    className={`w-full py-3 rounded-lg font-semibold text-white transition-all duration-300 flex items-center justify-center ${plan.buttonColor} ${
                      selectedPlan === plan.id ? 'ring-2 ring-offset-2 ring-blue-400' : ''
                    }`}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePlanSelect(plan.id)}
                  >
                    {plan.price === 'Custom' ? 'Contact Sales' : plan.price === 'Free' ? 'Continue Free' : 'Get Started'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
            
            {/* Additional Information */}
            <motion.div 
              className="bg-gray-50 rounded-xl p-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex flex-col md:flex-row items-center justify-center space-y-4 md:space-y-0 md:space-x-8">
                <div className="flex items-center">
                  <Shield className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">30-day money-back guarantee</span>
                </div>
                <div className="flex items-center">
                  <Zap className="w-5 h-5 text-blue-500 mr-2" />
                  <span className="text-sm text-gray-700">No setup fees</span>
                </div>
                <div className="flex items-center">
                  <Check className="w-5 h-5 text-green-500 mr-2" />
                  <span className="text-sm text-gray-700">Cancel anytime</span>
                </div>
              </div>
              
              {isBlocking && (
                <motion.p 
                  className="mt-4 text-sm text-gray-600"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                >
                  Your access has been paused. Select a plan to continue using the CRM.
                </motion.p>
              )}
            </motion.div>
          </div>

          {/* Footer */}
          <div className="bg-gray-100 p-4 text-center">
            <p className="text-xs text-gray-600">
              Need help deciding? <button className="text-blue-600 hover:text-blue-800 font-medium">Contact our sales team</button>
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlanModal;