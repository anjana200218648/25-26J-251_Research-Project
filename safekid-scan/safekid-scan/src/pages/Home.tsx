import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  useEffect(() => {
    const hasOnboarded = localStorage.getItem('childsafe-onboarded');
    
    if (hasOnboarded) {
      navigate('/upload');
    } else {
      navigate('/onboarding');
    }
  }, [navigate]);

  return null;
}
