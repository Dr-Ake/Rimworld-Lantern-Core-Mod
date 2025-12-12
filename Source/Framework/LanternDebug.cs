namespace DrAke.LanternsFramework
{
    public static class LanternDebug
    {
        public static bool LoggingEnabled => LanternCoreMod.Settings?.debugLogging == true;
        public static bool GizmosEnabled => LanternCoreMod.Settings?.debugGizmos == true;
    }
}

