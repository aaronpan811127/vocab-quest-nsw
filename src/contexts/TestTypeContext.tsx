import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TestType {
  id: string;
  code: string;
  name: string;
  description: string | null;
}

interface TestTypeContextType {
  testTypes: TestType[];
  selectedTestType: TestType | null;
  setSelectedTestType: (testType: TestType | null) => void;
  loading: boolean;
}

const TestTypeContext = createContext<TestTypeContextType | undefined>(undefined);

export const TestTypeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [testTypes, setTestTypes] = useState<TestType[]>([]);
  const [selectedTestType, setSelectedTestType] = useState<TestType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestTypes();
  }, []);

  useEffect(() => {
    if (user && testTypes.length > 0) {
      fetchDefaultTestType();
    }
  }, [user, testTypes]);

  const fetchTestTypes = async () => {
    const { data, error } = await supabase
      .from("test_types")
      .select("*")
      .order("code");

    if (error) {
      console.error("Error fetching test types:", error);
    } else {
      setTestTypes(data || []);
    }
    setLoading(false);
  };

  const fetchDefaultTestType = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("default_test_type_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching default test type:", error);
      return;
    }

    if (data?.default_test_type_id) {
      const defaultType = testTypes.find(t => t.id === data.default_test_type_id);
      if (defaultType) {
        setSelectedTestType(defaultType);
      }
    }
  };

  return (
    <TestTypeContext.Provider value={{ testTypes, selectedTestType, setSelectedTestType, loading }}>
      {children}
    </TestTypeContext.Provider>
  );
};

export const useTestType = () => {
  const context = useContext(TestTypeContext);
  if (!context) {
    throw new Error("useTestType must be used within a TestTypeProvider");
  }
  return context;
};
