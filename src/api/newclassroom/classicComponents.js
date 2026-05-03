const classicComponentMetadata = [
    {
        type: "platform",
        label: "讲台",
        icon: "fa-chalkboard-teacher"
    },
    {
        type: "big_group",
        label: "大组",
        icon: "fa-object-group"
    },
    {
        type: "aisle",
        label: "走廊",
        icon: "fa-road"
    },
    {
        type: "window",
        label: "窗户",
        icon: "fa-window-maximize"
    },
    {
        type: "door",
        label: "门",
        icon: "fa-door-closed"
    },
    {
        type: "multimedia",
        label: "多媒体",
        icon: "fa-tv"
    }
];

const getClassicComponentMetadata = () => classicComponentMetadata;

export { classicComponentMetadata, getClassicComponentMetadata };
