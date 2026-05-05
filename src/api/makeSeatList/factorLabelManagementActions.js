import { buildRewardConfigEntry, buildEvolutionPayload, buildProfileData, applyLoadedProfileData } from './seatPlanActions';

export const createFactorLabelManagementHandlers = (deps) => {
    const {
        conditions,
        names,
        personalAttrs,
        labels,
        profileName,
        profileDescription,
        profileList,
        activeProfileId,
        activeProfileName,
        profileLoadedRef,
        navigate,
        invoke,
        message,
        setPersonalAttrs,
        setConditions,
        setLabels,
        setSelectedLabelId,
        setClassroomForEvolution,
        setStartEvolutionOpen,
        setStartingEvolution,
        setProfileLoading,
        setProfileList,
        setProfileSaving,
        setSaveProfileModalOpen,
        setProfileName,
        setProfileDescription,
        setLoadProfileModalOpen,
        setActiveProfileId,
        setActiveProfileName,
        setActiveProfileDescription,
        setProfileUpdating,
    } = deps;

    const handlePersonalSave = (jsonData) => {
        setPersonalAttrs(jsonData);
        if (jsonData.length > 0) {
            message.success(`已保存 ${jsonData.length} 人的个人属性数据`);
        }
    };

    const handleConditionSettingsSave = (data) => {
        setConditions(prev => {
            const existingIdx = prev.findIndex(c => c._isRewardConfig);
            const rewardEntry = buildRewardConfigEntry(data);
            if (existingIdx >= 0) {
                const next = [...prev];
                next[existingIdx] = rewardEntry;
                return next;
            }
            return [...prev, rewardEntry];
        });
        message.success('奖励配置已保存');
    };

    const handleOpenEvolutionConfirm = async () => {
        const rewardConfig = conditions.find(c => c._isRewardConfig);
        if (!rewardConfig) {
            message.warning('请先保存奖励配置');
            return;
        }
        if (personalAttrs.length === 0) {
            message.warning('请先配置个人属性数据');
            return;
        }
        const classroomSgid = rewardConfig.classroomSgid;
        if (!classroomSgid) {
            message.warning('奖励配置中未关联教室，请先进入奖励配置选择教室');
            return;
        }
        try {
            const rows = await invoke('get_dashboard_records');
            const available = (Array.isArray(rows) ? rows : []).filter(item => !item?.is_broken);
            const matched = available.find(c => c.sgid === classroomSgid);
            if (!matched) {
                message.error('未找到关联的教室数据，请检查奖励配置中的教室选择');
                return;
            }
            setClassroomForEvolution(matched);
            setStartEvolutionOpen(true);
        } catch (err) {
            console.error('获取教室信息失败', err);
            message.error('获取教室信息失败：' + String(err));
        }
    };

    const handleStartEvolution = async (classroom) => {
        const rewardConfig = conditions.find(c => c._isRewardConfig);

        setStartingEvolution(true);
        try {
            await invoke('start_evolution', { payload: buildEvolutionPayload({ classroom, names, personalAttrs, conditions, rewardConfig }) });

            setStartEvolutionOpen(false);
            setClassroomForEvolution(null);
            message.success('已启动遗传算法演化任务');
            navigate('/evolution-status', { state: { classroom } });
        } catch (err) {
            console.error('启动演化失败', err);
            message.error('启动演化失败：' + String(err));
        } finally {
            setStartingEvolution(false);
        }
    };

    const loadProfileList = async () => {
        setProfileLoading(true);
        try {
            const list = await invoke('get_profile_list');
            setProfileList(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error('加载档案列表失败', error);
            message.error('加载档案列表失败：' + String(error));
        } finally {
            setProfileLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!profileName.trim()) {
            message.warning('请输入档案名称');
            return;
        }

        setProfileSaving(true);
        try {
            const rewardConfig = conditions.find(c => c._isRewardConfig);
            const data = buildProfileData({ rewardConfig, names, personalAttrs, conditions, labels });

            await invoke('save_profile', {
                name: profileName.trim(),
                description: profileDescription.trim(),
                data,
            });

            message.success(`档案「${profileName.trim()}」保存成功`);
            setSaveProfileModalOpen(false);
            setProfileName('');
            setProfileDescription('');
        } catch (error) {
            console.error('保存档案失败', error);
            message.error('保存档案失败：' + String(error));
        } finally {
            setProfileSaving(false);
        }
    };

    const handleLoadProfile = async (profile) => {
        const profileId = typeof profile === 'object' ? profile.id : profile;
        const matched = typeof profile === 'object'
            ? profile
            : profileList.find(item => item.id === profileId);
        setProfileLoading(true);
        try {
            const data = await invoke('load_profile', { id: profileId });
            const next = applyLoadedProfileData(data);
            if (next.personalAttrs) {
                setPersonalAttrs(next.personalAttrs);
            }
            if (next.conditions) {
                setConditions(next.conditions);
            }
            if (next.labels) {
                const normalized = next.labels;
                setLabels(normalized);
                setSelectedLabelId(normalized[0]?.id || null);
                try {
                    await invoke('save_default_labels', {
                        labels: normalized.map(({ id, ...rest }) => rest),
                    });
                } catch (err) {
                    console.error('保存加载的标签失败', err);
                }
            }

            profileLoadedRef.current = true;
            setActiveProfileId(profileId);
            setActiveProfileName(matched?.name || '');
            setActiveProfileDescription(matched?.description || '');
            message.success('档案加载成功');
            setLoadProfileModalOpen(false);
        } catch (error) {
            console.error('加载档案失败', error);
            message.error('加载档案失败：' + String(error));
        } finally {
            setProfileLoading(false);
        }
    };

    const handleUpdateActiveProfile = async () => {
        if (!activeProfileId) {
            message.warning('请先加载一个档案');
            return;
        }
        setProfileUpdating(true);
        try {
            const rewardConfig = conditions.find(c => c._isRewardConfig);
            const data = buildProfileData({ rewardConfig, names, personalAttrs, conditions, labels });
            await invoke('update_profile', {
                id: activeProfileId,
                data,
            });
            message.success(`已更新档案「${activeProfileName || '未命名档案'}」`);
            loadProfileList();
        } catch (error) {
            console.error('更新档案失败', error);
            message.error('更新档案失败：' + String(error));
        } finally {
            setProfileUpdating(false);
        }
    };

    const handleDeleteProfile = async (profileId) => {
        try {
            await invoke('delete_profile', { id: profileId });
            message.success('档案已删除');
            loadProfileList();
        } catch (error) {
            console.error('删除档案失败', error);
            message.error('删除档案失败：' + String(error));
        }
    };

    return {
        handlePersonalSave,
        handleConditionSettingsSave,
        handleOpenEvolutionConfirm,
        handleStartEvolution,
        loadProfileList,
        handleSaveProfile,
        handleLoadProfile,
        handleUpdateActiveProfile,
        handleDeleteProfile,
    };
};
